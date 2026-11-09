// Intake: fills a new client's profile from their own site (and code, if
// available), so `mm new <slug> --url <site>` is the only thing a human types.
// Anything it can't establish becomes a question, never a guess.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { defineProduct, z, Playbook, system, asJson, readInputs, tools, writeYaml, writeFile } from "@mm/core";

const Input = z.object({ url: z.string().optional() });

const Answer = z.object({
  name: z.string(),
  playbook: Playbook.describe("consumer = sells products/tickets to individuals; b2b_service = sells services to businesses; creator_media = audience/community/events/content brand"),
  description: z.string().describe("One factual paragraph in plain words, from the evidence"),
  geo: z.array(z.string()),
  icp: z.string(),
  offers: z.array(z.object({ name: z.string(), price: z.string().optional(), description: z.string() })),
  competitors: z.array(z.string()).describe("Only ones named or clearly implied in the evidence; otherwise empty"),
  voices: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })).describe("Founders or named people who could post for the brand, from the evidence"),
  tone: z.string(),
  colors: z.array(z.string()).describe("Hex colours found in the site's CSS/theme, if any"),
  currency: z.string(),
  constraints: z.array(z.string()),
  auditPages: z.array(z.string()).describe("Paths of the main conversion pages to audit (signup, RSVP, checkout, contact, pricing)"),
  questions: z.array(z.string()).describe("What a human must answer because the evidence doesn't say"),
});

export default defineProduct({
  manifest: {
    id: "intake",
    name: "Intake",
    job: "Fill a new client's profile from their site and code so onboarding needs only a URL; anything unclear becomes a question.",
    defaultAutonomy: "A0",
    defaultSchedule: "on-demand (first step of onboarding)",
    reads: ["client URL (live)", "inputs/intake/* (saved pages)", "client.audit.codebase README/package.json"],
    writes: ["client.yaml (draft → filled)", "out/intake-questions.md"],
    connectors: ["Web fetch / browser (save pages to inputs/intake/ if the engine can't reach the site)"],
    apis: [],
    skill: {
      gather: ["If the site isn't reachable from the engine, save the homepage, about, pricing/offer and contact pages as text into inputs/intake/."],
      act: ["`mm new <slug> --url <site>` then `mm onboard` runs Intake first. Answer out/intake-questions.md and edit client.yaml if anything is off."],
    },
    evidence: ["08-positioning-messaging"],
  },
  input: Input,

  async gather(ctx, input) {
    const url = input.url ?? ctx.client.url;
    const pages: Record<string, string> = {};
    if (url) {
      const base = url.replace(/\/$/, "");
      for (const p of ["", "/about", "/pricing", "/contact"]) {
        const raw = await tools.fetchRaw(base + p, 12000);
        if (raw.ok) {
          const colors = [...new Set(raw.html.match(/#[0-9a-fA-F]{6}\b/g) ?? [])].slice(0, 12);
          pages[base + p] = (await tools.fetchText(base + p, 6000)) + (colors.length ? `\n[colours in page: ${colors.join(" ")}]` : "");
        }
      }
    }
    const code: Record<string, string> = {};
    const root = ctx.client.audit.codebase;
    if (root && existsSync(root)) {
      for (const f of ["README.md", "package.json", "public/llms.txt", "public/brand.json"]) {
        const p = join(root, f);
        if (existsSync(p)) code[f] = readFileSync(p, "utf8").slice(0, 8000);
      }
    }
    return { url, pages, saved: readInputs(ctx.client.slug, "intake", 10000), code };
  },

  think(ctx, _input, ev) {
    return {
      name: "intake.profile",
      schema: Answer,
      system: system(ctx, "Intake, who sets up new clients", ["positioning"], [
        "Use only the evidence. If something isn't stated (prices, founders, geography), leave it out and add a question.",
        "Pick the playbook by how the business makes money, not by industry words.",
        "Descriptions are factual and plain: what they sell, to whom, where.",
      ]),
      prompt: [asJson("url", ev.url), asJson("live_pages", ev.pages), asJson("saved_pages", ev.saved), asJson("codebase_files", ev.code)].join("\n\n"),
    };
  },

  async finish(ctx, _input, _ev, answer) {
    const a = Answer.parse(answer);
    const file = ctx.path("client.yaml");
    const cur = YAML.parse(readFileSync(file, "utf8"));
    const next = {
      ...cur,
      name: a.name,
      playbook: a.playbook,
      description: a.description,
      geo: a.geo,
      icp: a.icp,
      offers: a.offers,
      competitors: a.competitors.length ? a.competitors : cur.competitors,
      voices: a.voices.length ? a.voices.map((v) => ({ ...v, channels: ["linkedin", "instagram"], rules: ["Plain and direct, first person"] })) : cur.voices,
      brand: { ...cur.brand, tone: a.tone, colors: a.colors.length ? a.colors : cur.brand?.colors },
      currency: a.currency || cur.currency,
      constraints: a.constraints,
      audit: { ...(cur.audit ?? {}), pages: a.auditPages },
      draft: false,
    };
    writeYaml(file, next);
    writeFile(ctx.path("out", "intake-questions.md"), `# Questions for ${a.name}\n\nIntake filled client.yaml from the site. Please answer or correct:\n\n${a.questions.map((q) => `- [ ] ${q}`).join("\n") || "- none"}\n`);
    return a;
  },

  summarize: (a) => `profile filled for ${a.name} (${a.playbook}), ${a.offers.length} offers, ${a.questions.length} open questions`,
});
