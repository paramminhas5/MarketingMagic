// Hunter: signal-based outbound for B2B. It builds segments from intent signals
// and writes short sequences, but every new sequence is approved and edited by a
// human before a single email goes out (manually edited copy wins, [04]).
import { defineProduct, z, Strategy, system, asJson, requireDoc, readInputs, makeAsset, sequenceIssues, writeFile, today, tools, DELIVERABILITY } from "@mm/core";

const Input = z.object({
  segment: z.string().optional().describe("Focus segment; default: let Hunter pick from signals"),
  apolloFilters: z.record(z.string(), z.unknown()).optional().describe("Headless only: Apollo people search filters"),
});

const Step = z.object({ day: z.number().int(), channel: z.enum(["email", "linkedin"]), subject: z.string().optional(), body: z.string() });
const Answer = z.object({
  segments: z.array(
    z.object({
      name: z.string(),
      signal: z.string().describe("The trigger that makes now the right time"),
      whyNow: z.string(),
      accounts: z.array(z.string()).describe("Company names from the evidence that fit, if any"),
      steps: z.array(Step),
    }),
  ),
  personalisationRules: z.array(z.string()),
  dontContact: z.array(z.string()).describe("Who to exclude and why"),
});

export default defineProduct({
  manifest: {
    id: "hunter",
    name: "Hunter",
    job: "Find accounts showing buying signals and write short, segment-specific outbound sequences for a human to edit and approve.",
    defaultAutonomy: "A2",
    defaultSchedule: "0 8 * * 1-5 (signals) · sequences on-demand",
    reads: ["research/strategy.json", "client.icp", "inputs/hunter/* (Clay/Apollo exports)"],
    writes: ["assets(kind=sequence) always A2", "out/hunter/<date>.md"],
    connectors: ["Clay (search, enrichment, signals)", "Apollo (people/org search, enrichment, validation, sequences, website visitors)", "Gmail (replies)"],
    apis: ["APOLLO_API_KEY"],
    skill: {
      gather: [
        "Clay: search-companies / search-contacts for the ICP with signals (funding, new marketing leader, marketing hires, job changes of past champions); save to inputs/hunter/clay.json",
        "Apollo: apollo_organizations_job_postings for marketing roles at ICP accounts; apollo_website_visitors_domain_aggregates if tracking is installed; save to inputs/hunter/apollo.json",
        "Verify emails (apollo_email_validation_validate) before any sequence. Bounce > 2% pauses everything.",
      ],
      act: [
        "Run `mm run hunter --client <slug>`.",
        "A human edits each sequence. Then create it in Apollo (apollo_sequences_create) on warmed secondary domains only, max 15-25 sends per mailbox per day.",
      ],
    },
    evidence: ["04-outbound-leadgen", "10-ai-native-marketing-ops"],
  },
  input: Input,

  async gather(ctx, input) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Strategist first.");
    let apollo: unknown;
    if (tools.hasApollo() && input.apolloFilters) apollo = await tools.apolloPeopleSearch(input.apolloFilters);
    return { strategy, exports: readInputs(ctx.client.slug, "hunter", 15000), apollo };
  },

  think(ctx, input, ev) {
    return {
      name: "hunter.sequences",
      schema: Answer,
      system: system(ctx, "Hunter, an outbound lead", ["outbound", "aiOps", "positioning"], [
        "Signal first: every segment is defined by a trigger that makes now the right time (funding, new CMO, hiring marketers, launching in a new city, ad spend changes, job change of a past champion).",
        "Sequences: 4-7 steps, email bodies 50-125 words, plain text, no links in step 1, one clear ask, sounds like one person writing to one person.",
        "Write in the client's founder voice, plainly. No flattery openers, no 'hope this finds you well', no fake familiarity.",
        "Never claim results the client can't prove.",
      ]),
      prompt: [
        input.segment ? `Focus segment: ${input.segment}` : "",
        `ICP: ${ctx.client.icp ?? "derive from strategy"}`,
        asJson("positioning", ev.strategy.positioning),
        asJson("offers", ev.strategy.offers),
        asJson("signal_exports", ev.exports),
        ev.apollo ? asJson("apollo_results", ev.apollo) : "",
      ].join("\n\n"),
    };
  },

  async finish(ctx, _input, _ev, answer) {
    const a = Answer.parse(answer);
    const assets = a.segments.map((s) => {
      const issues = sequenceIssues(s.steps);
      return makeAsset(ctx, "hunter", {
        kind: "sequence",
        channel: "email",
        title: `${s.name} · ${s.signal}`,
        body: s.steps.map((st, i) => `Step ${i + 1} · day ${st.day} · ${st.channel}${st.subject ? ` · ${st.subject}` : ""}\n${st.body}`).join("\n\n"),
        tags: { segment: s.name },
        meta: { signal: s.signal, whyNow: s.whyNow, accounts: s.accounts, steps: s.steps, issues, deliverability: DELIVERABILITY },
        approval: { status: "pending", level: "A2" },
      });
    });
    await ctx.store.insertMany("assets", assets);
    writeFile(
      ctx.path("out", "hunter", `${today()}.md`),
      [
        `# Hunter · ${ctx.client.name} · ${today()}`,
        `Personalisation rules:\n${a.personalisationRules.map((r) => `- ${r}`).join("\n")}\n\nDo not contact:\n${a.dontContact.map((r) => `- ${r}`).join("\n")}`,
        ...assets.map((s) => `## ${s.title} \`${s.id}\`\nWhy now: ${s.meta.whyNow}\n\nAccounts: ${(s.meta.accounts as string[]).join(", ") || "-"}\n\n${(s.meta.issues as string[]).length ? `**Fix before approval:** ${(s.meta.issues as string[]).join("; ")}\n\n` : ""}${s.body}`),
      ].join("\n\n"),
    );
    return assets;
  },

  summarize: (a) => `${a.length} signal segments with sequences (awaiting human edit)`,
});
