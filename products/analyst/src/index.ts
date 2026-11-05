// Analyst closes every loop: what happened, what it means, what each product
// should do next. Numbers are computed in code; the model only interprets them.
import { defineProduct, z, Asset, Lead, MetricRow, Learning, Strategy, system, asJson, loadDoc, newId, adDecisions, isSignificant, writeFile, today, ProductId } from "@mm/core";

const Input = z.object({
  days: z.number().int().min(1).max(90).default(7),
  targetCostPerResult: z.number().optional(),
});

const Answer = z.object({
  headline: z.string().describe("One sentence: the most important thing that happened"),
  memo: z.string().describe("Markdown, under 300 words: what worked, what didn't, why, what next"),
  learnings: z.array(z.object({ claim: z.string(), evidence: z.string(), scope: z.enum(["brand", "vertical", "global"]), confidence: z.enum(["low", "medium", "high"]) })),
  nextBriefs: z.array(z.object({ product: ProductId, brief: z.string() })),
});

export default defineProduct({
  manifest: {
    id: "analyst",
    name: "Analyst",
    job: "Turn spend, leads and self-reported attribution into a weekly memo, kill/scale calls, new learnings and briefs for the other products.",
    defaultAutonomy: "A0",
    defaultSchedule: "0 7 * * * (daily numbers) · 0 8 * * 1 (weekly memo)",
    reads: ["metrics", "leads", "assets", "learnings"],
    writes: ["learnings", "out/analyst/<date>.md"],
    connectors: ["Meta Ads insights + lift tests", "Apollo analytics", "Ahrefs web analytics + GSC", "Vercel analytics", "Windsor.ai (when connected)"],
    apis: ["META_ACCESS_TOKEN"],
    skill: {
      gather: [
        "Pull last N days of ad-level Meta insights and import with `mm import metrics <file>` (rows: date, channel, entityId, entityName, spend, impressions, clicks, results, revenue, frequency).",
        "Apollo: apollo_analytics_sync_report for sequence reply rates; save to inputs/analyst/apollo.json",
      ],
      act: ["Run `mm run analyst --client <slug>`.", "Send the memo; route nextBriefs to the named products (the Conductor does this in `mm cycle`)."],
    },
    evidence: ["09-analytics-attribution", "03-paid-acquisition"],
  },
  input: Input,

  async gather(ctx, input) {
    const since = new Date(Date.now() - input.days * 864e5).toISOString().slice(0, 10);
    const metrics = await ctx.store.list<MetricRow>("metrics", (m) => m.date >= since);
    const leads = await ctx.store.list<Lead>("leads", (l) => l.createdAt.slice(0, 10) >= since);
    const assets = await ctx.store.list<Asset>("assets");
    const learnings = (await ctx.store.list<Learning>("learnings")).slice(-20);
    const strategy = loadDoc(ctx, "strategy", Strategy);

    const spend = metrics.reduce((a, m) => a + m.spend, 0);
    const results = metrics.reduce((a, m) => a + m.results, 0);
    const revenue = metrics.reduce((a, m) => a + m.revenue, 0);
    const byChannel: Record<string, { spend: number; results: number }> = {};
    for (const m of metrics) {
      byChannel[m.channel] ??= { spend: 0, results: 0 };
      byChannel[m.channel].spend += m.spend;
      byChannel[m.channel].results += m.results;
    }
    const hdyhau: Record<string, number> = {};
    for (const l of leads) hdyhau[l.hdyhauCoded ?? "uncoded"] = (hdyhau[l.hdyhauCoded ?? "uncoded"] ?? 0) + 1;

    // performance by creative motivation (joins metrics -> asset tags)
    const byMotivation: Record<string, { spend: number; results: number; ads: number }> = {};
    for (const m of metrics) {
      const a = assets.find((x) => x.id === m.assetId || x.live?.externalId === m.entityId);
      const k = a?.tags.motivation ?? "untagged";
      byMotivation[k] ??= { spend: 0, results: 0, ads: 0 };
      byMotivation[k].spend += m.spend;
      byMotivation[k].results += m.results;
    }
    const target = input.targetCostPerResult;
    const decisions = target ? adDecisions(metrics.filter((m) => m.channel === "meta"), target) : [];
    const funnel = {
      leads: leads.length,
      hot: leads.filter((l) => l.route === "hot").length,
      booked: leads.filter((l) => l.status === "booked").length,
      won: leads.filter((l) => l.status === "won").length,
    };
    const pendingApprovals = assets.filter((a) => a.approval.status === "pending").length;
    return {
      window: { since, days: input.days },
      totals: { spend, results, revenue, costPerResult: results ? spend / results : null, roas: spend ? revenue / spend : null },
      byChannel,
      byMotivation: Object.fromEntries(Object.entries(byMotivation).map(([k, v]) => [k, { ...v, costPerResult: v.results ? v.spend / v.results : null, significant: isSignificant(v.results) }])),
      hdyhau,
      funnel,
      decisions,
      pendingApprovals,
      primaryMetric: strategy?.primaryMetric,
      learnings: learnings.map((l) => l.claim),
    };
  },

  think(ctx, _input, ev) {
    return {
      name: "analyst.memo",
      schema: Answer,
      system: system(ctx, "Analyst, a marketing measurement lead", ["analytics"], [
        "Trust self-reported 'how did you hear about us' over platform attribution for channel credit; platforms over-claim.",
        "Only call a winner when `significant` is true; otherwise say 'directional'.",
        "Judge everything by the primary metric and cost per result, not CTR or opens.",
        "nextBriefs are concrete instructions to other products (e.g. studio: '3 new concepts on scarcity-drop in founder_talking_head format').",
        "No numbers that are not in the data.",
      ]),
      prompt: asJson("data", ev),
    };
  },

  async finish(ctx, _input, ev, answer) {
    const a = Answer.parse(answer);
    const learnings: Learning[] = a.learnings.map((l) => ({ id: newId("learning"), client: ctx.client.slug, createdAt: new Date().toISOString(), ...l }));
    await ctx.store.insertMany("learnings", learnings);
    const t = ev.totals;
    const md = [
      `# ${ctx.client.name} · ${ev.window.days}-day memo · ${today()}`,
      `**${a.headline}**`,
      `Spend ${t.spend.toFixed(0)} · results ${t.results} · cost/result ${t.costPerResult?.toFixed(0) ?? "-"} · revenue ${t.revenue.toFixed(0)} · leads ${ev.funnel.leads} (hot ${ev.funnel.hot}, booked ${ev.funnel.booked}, won ${ev.funnel.won}) · approvals waiting ${ev.pendingApprovals}`,
      a.memo,
      `## How people say they found us\n${Object.entries(ev.hdyhau).sort((x, y) => y[1] - x[1]).map(([k, v]) => `- ${k}: ${v}`).join("\n") || "- no leads yet"}`,
      ev.decisions.length ? `## Ad decisions\n${ev.decisions.map((d) => `- **${d.action}** ${d.entityName || d.entityId}: ${d.reason}`).join("\n")}` : "",
      `## Learnings\n${a.learnings.map((l) => `- (${l.confidence}, ${l.scope}) ${l.claim} · ${l.evidence}`).join("\n")}`,
      `## Next briefs\n${a.nextBriefs.map((b) => `- **${b.product}**: ${b.brief}`).join("\n")}`,
    ].filter(Boolean).join("\n\n");
    writeFile(ctx.path("out", "analyst", `${today()}.md`), md);
    writeFile(ctx.path("out", "analyst", "next-briefs.json"), JSON.stringify(a.nextBriefs, null, 2));
    return a;
  },

  summarize: (a) => a.headline,
});
