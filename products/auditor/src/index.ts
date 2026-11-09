// Auditor: the readiness gate. Checks the funnel for known leaks, scores it,
// and decides whether the engine may spend money (paid) or send cold email.
// Deterministic by design: no model call, same funnel → same verdict.
import { defineProduct, z, Readiness, Strategy, loadDoc, saveDoc, writeFile, type CheckResult } from "@mm/core";
import { gatherEvidence, type Evidence } from "./evidence.ts";
import { runChecks, score, gateOpen } from "./checks.ts";
import { writeFixKit, openingPlaybook } from "./fixkit.ts";

const Input = z.object({
  offline: z.boolean().default(false).describe("Skip live fetches and DNS; use saved pages, codebase and engine state only"),
});

const icon = { pass: "✓", warn: "!", fail: "✗", unknown: "?" } as const;

function md(r: Readiness, previous: Readiness | undefined, fixes: string[]): string {
  const prev = new Map(previous?.checks.map((c) => [c.id, c.status]) ?? []);
  const fixed = r.checks.filter((c) => c.status === "pass" && prev.has(c.id) && prev.get(c.id) !== "pass");
  const regressed = r.checks.filter((c) => c.status !== "pass" && prev.get(c.id) === "pass");
  const cats = [...new Set(r.checks.map((c) => c.category))];
  return [
    `# Readiness · ${r.client} · ${r.at.slice(0, 10)}`,
    `**Score ${r.score}/100** · paid spend ${r.spendUnlocked ? "**unlocked**" : "**locked**"} · outbound ${r.outboundUnlocked ? "**unlocked**" : "**locked**"}${previous ? ` · previous ${previous.score}/100` : ""}`,
    r.blockers.length ? `## Blocking\n${r.blockers.map((b) => `- ${b}`).join("\n")}` : "",
    fixed.length ? `## Fixed since last audit\n${fixed.map((c) => `- ${c.title}`).join("\n")}` : "",
    regressed.length ? `## Regressed\n${regressed.map((c) => `- ${c.title}`).join("\n")}` : "",
    ...cats.map(
      (cat) =>
        `## ${cat}\n| | check | severity | evidence | fix |\n|---|---|---|---|---|\n${r.checks
          .filter((c) => c.category === cat)
          .map((c) => `| ${icon[c.status]} | ${c.title} | ${c.severity} | ${c.evidence.replace(/\n/g, "<br>").replace(/\|/g, "/")} | ${c.status === "pass" ? "" : c.fix.replace(/\|/g, "/")} |`)
          .join("\n")}`,
    ),
    `## Evidence sources\n${r.sources.map((s) => `- ${s}`).join("\n")}`,
    fixes.length ? `## Fix kit written\n${fixes.map((f) => `- ${f}`).join("\n")}` : "",
    "_Something the Auditor can't see but you've confirmed? Add it under `audit.attest` in client.yaml, e.g. `deliverability.warmup: \"warmed since Nov 1\"`._",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default defineProduct({
  manifest: {
    id: "auditor",
    name: "Auditor",
    job: "Check the funnel for known leaks before any money is spent, score readiness, lock or unlock paid spend and outbound, and write the fixes.",
    defaultAutonomy: "A0",
    defaultSchedule: "5 8 * * 1 (weekly) + before every campaign",
    reads: ["live site + robots/sitemap/llms.txt", "inputs/auditor/* (saved pages)", "client.audit.codebase", "machine.yaml", "assets", "leads", "DNS for sending domains"],
    writes: ["research/readiness.json + .md", "out/fixes/*", "out/opening-playbook.md"],
    connectors: ["Web fetch / browser (save pages to inputs/auditor/ when the engine can't reach the site)", "The client's code repo (set audit.codebase)"],
    apis: [],
    skill: {
      gather: [
        "If the live site isn't reachable from the engine, save the homepage and main conversion pages (RSVP, signup, contact, checkout) with WebFetch or the browser as raw HTML into inputs/auditor/<page>.html.",
        "If the client's code is available, clone it and set client.yaml audit.codebase to its path.",
      ],
      act: [
        "Run `mm run auditor --client <slug>`.",
        "Share out/opening-playbook.md. Engine-owned fixes can run now; human and developer fixes go to the owner.",
        "Spend and outbound stay locked until blockers pass. A human can attest checks the engine can't see in client.yaml audit.attest.",
      ],
    },
    evidence: ["05-conversion", "06-lifecycle-retention", "09-analytics-attribution", "04-outbound-leadgen", "02-inbound-seo-geo"],
  },
  input: Input,

  async gather(ctx, input): Promise<Evidence> {
    return gatherEvidence(ctx, { offline: input.offline });
  },

  async finish(ctx, _input, ev) {
    const previous = loadDoc(ctx, "readiness", Readiness);
    const checks: CheckResult[] = runChecks(ctx, ev);
    const spend = gateOpen(checks, "spend");
    const outbound = gateOpen(checks, "outbound");
    const readiness = Readiness.parse({
      client: ctx.client.slug,
      at: new Date().toISOString(),
      score: score(checks),
      spendUnlocked: spend.open,
      outboundUnlocked: outbound.open,
      blockers: [...new Set([...spend.blockers, ...outbound.blockers].map((c) => `${c.title}: ${c.fix}`))],
      sources: ev.sources,
      checks,
    });
    const fixes = writeFixKit(ctx, checks, loadDoc(ctx, "strategy", Strategy));
    await saveDoc(ctx, "readiness", readiness, md(readiness, previous, fixes));
    writeFile(ctx.path("out", "opening-playbook.md"), openingPlaybook(ctx, checks));
    return { readiness, fixes, previousScore: previous?.score };
  },

  summarize: (o) =>
    `readiness ${o.readiness.score}/100${o.previousScore !== undefined ? ` (was ${o.previousScore})` : ""} · spend ${o.readiness.spendUnlocked ? "unlocked" : "locked"} · outbound ${o.readiness.outboundUnlocked ? "unlocked" : "locked"} · ${o.readiness.checks.filter((c) => c.status !== "pass").length} open items`,
});
