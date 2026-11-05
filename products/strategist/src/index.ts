import {
  defineProduct,
  z,
  MarketBrief,
  Strategy,
  Learning,
  system,
  asJson,
  saveDoc,
  requireDoc,
  makeAsset,
  bullets,
} from "@mm/core";

const Input = z.object({
  objective: z.string().optional().describe("e.g. 'sell 300 tickets for Dec 13' or 'book 10 qualified calls a month'"),
  offer: z.string().optional(),
  budgetNote: z.string().optional(),
});

export default defineProduct({
  manifest: {
    id: "strategist",
    name: "Strategist",
    job: "Decide what to say, to whom, where, and how to test it: positioning, motivation matrix, offers, channel plan.",
    defaultAutonomy: "A2",
    defaultSchedule: "on-demand (onboarding, new campaign) + monthly review",
    reads: ["research/market-brief.json", "learnings"],
    writes: ["research/strategy.json", "research/strategy.md", "assets(kind=strategy) for approval"],
    connectors: ["Google Drive / Claude Docs (to share the strategy doc)"],
    apis: [],
    skill: {
      gather: ["Make sure research/market-brief.json exists (run Scout first)."],
      act: [
        "Run `mm run strategist --client <slug>` (answer the pending step if no API key).",
        "Send the strategy for approval: `mm approvals` lists it. Nothing downstream should treat it as final until approved.",
      ],
    },
    evidence: ["08-positioning-messaging", "00-synthesis", "03-paid-acquisition"],
  },
  input: Input,

  async gather(ctx) {
    const brief = requireDoc(ctx, "market-brief", MarketBrief, "Run `mm run scout` first.");
    const learnings = (await ctx.store.list<Learning & { [k: string]: unknown }>("learnings")).slice(-30);
    return { brief, learnings };
  },

  think(ctx, input, ev) {
    return {
      name: "strategist.strategy",
      schema: Strategy,
      system: system(ctx, "Strategist, a positioning and growth strategist", ["synthesis", "positioning", "paid", "demand"], [
        "Positioning follows the competitive-alternatives method: what customers would do otherwise, what is uniquely true here, the value that creates, who cares most, the market frame.",
        "The motivation matrix is the backbone of creative diversity on Meta: 5-8 motivations that are genuinely different reasons to act (price, scarcity, identity, social proof, ease, performance, fear of missing out...), each with proof points the client can actually back up.",
        "Use the default playbook for the client's playbook type from the synthesis, then adapt it.",
        "Budget shares across channels must sum to 1. Every test needs a minimum sample and a kill rule.",
        "Frameworks are hypotheses: every offer needs a stated risk.",
      ]),
      prompt: [
        input.objective ? `Objective: ${input.objective}` : "Objective: grow qualified demand for the client's main offer.",
        input.offer ? `Offer to lead with: ${input.offer}` : "",
        input.budgetNote ? `Budget: ${input.budgetNote}` : "",
        asJson("market_brief", ev.brief),
        asJson("learnings_so_far", ev.learnings),
        "Write the strategy.",
      ].join("\n\n"),
    };
  },

  async finish(ctx, input, _ev, answer) {
    const s = Strategy.parse(answer);
    const md = [
      `# Strategy: ${ctx.client.name}`,
      `_${new Date().toISOString().slice(0, 10)} · Strategist${input.objective ? ` · ${input.objective}` : ""}_`,
      `## Positioning\n> ${s.positioning.statement}\n\n**Alternatives:**\n${bullets(s.positioning.competitiveAlternatives)}\n\n**Unique:**\n${bullets(s.positioning.uniqueAttributes)}\n\n**Value:**\n${bullets(s.positioning.value)}\n\n**Best fit:** ${s.positioning.bestFitCustomer}\n\n**Category:** ${s.positioning.marketCategory}`,
      `## Motivation matrix\n| id | motivation | insight | proof | segments |\n|---|---|---|---|---|\n${s.motivations.map((m) => `| ${m.id} | ${m.name} | ${m.insight} | ${m.proofPoints.join("; ")} | ${m.segments.join(", ")} |`).join("\n")}`,
      `## Offers\n${s.offers.map((o) => `- **${o.name}**: ${o.structure}. Hypothesis: ${o.hypothesis}. Risk: ${o.risk}`).join("\n")}`,
      `## Channels\n| channel | role | budget | KPI | cadence |\n|---|---|---|---|---|\n${s.channels.map((c) => `| ${c.channel} | ${c.role} | ${(c.budgetShare * 100).toFixed(0)}% | ${c.kpi} | ${c.cadence} |`).join("\n")}`,
      `## Primary metric\n${s.primaryMetric.name}: ${s.primaryMetric.target}`,
      `## Tests\n${s.tests.map((t) => `- ${t.hypothesis} · metric: ${t.metric} · min sample: ${t.minSample} · kill: ${t.killRule}`).join("\n")}`,
      `## Risks\n${bullets(s.risks)}`,
    ].join("\n\n");
    await saveDoc(ctx, "strategy", s, md);
    await ctx.store.insert(
      "assets",
      makeAsset(ctx, "strategist", {
        kind: "strategy",
        channel: "internal",
        title: `Strategy: ${s.positioning.statement.slice(0, 80)}`,
        body: md,
      }),
    );
    return s;
  },

  summarize: (s) => `strategy: ${s.motivations.length} motivations, ${s.channels.length} channels, metric ${s.primaryMetric.name}`,
});
