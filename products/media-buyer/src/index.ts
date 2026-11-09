// Media Buyer runs paid channels the Andromeda way: broad targeting, many
// distinct creatives, platform AI for delivery, hard caps, humans approve launches.
import { defineProduct, z, Asset, MetricRow, Strategy, system, asJson, requireDoc, makeAsset, adDecisions, writeFile, today, tools, readinessGate, probBestCost, verdict } from "@mm/core";

const Input = z.object({
  mode: z.enum(["plan", "optimize"]).default("plan"),
  campaign: z.string().default("always-on"),
  objective: z.enum(["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_ENGAGEMENT", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"]).default("OUTCOME_LEADS"),
  targetCostPerResult: z.number().optional().describe("In client currency; required for optimize"),
  createPaused: z.boolean().default(false).describe("With META_ACCESS_TOKEN + accounts.meta_ad_account, create the campaign shell PAUSED"),
});

const Plan = z.object({
  campaignName: z.string(),
  structure: z.string().describe("e.g. 1 Advantage+ campaign, 1 broad ad set, all concepts in one ad set"),
  dailyBudget: z.number(),
  geo: z.array(z.string()),
  audience: z.string().describe("Broad by default; exclusions only"),
  exclusions: z.array(z.string()),
  placements: z.string(),
  adIds: z.array(z.string()).describe("Asset ids of approved ad concepts to include"),
  conversionEvent: z.string(),
  testPlan: z.string(),
  launchChecklist: z.array(z.string()),
});

export default defineProduct({
  manifest: {
    id: "media-buyer",
    name: "Media Buyer",
    job: "Plan, launch (paused, for approval) and optimise paid campaigns with broad targeting, diverse creative and hard spend caps.",
    defaultAutonomy: "A1",
    defaultSchedule: "30 9 * * * (daily optimise)",
    reads: ["assets(kind=ad, gate=passed, approved)", "metrics", "machine caps"],
    writes: ["assets(kind=campaign_plan)", "decisions in out/media-buyer/<date>.md", "Meta campaigns (PAUSED)"],
    connectors: ["Meta Ads (create campaign/ad set/ad/creative, insights, A/B + lift tests)", "LinkedIn/Google via Adspirer when connected"],
    apis: ["META_ACCESS_TOKEN", "client.accounts.meta_ad_account"],
    skill: {
      gather: [
        "Optimise mode: pull last 7 days of ad-level insights with Meta Ads (ads_get_ad_entities / insights) and save to inputs/media-buyer/insights.json as rows {date, entityId, entityName, spend, impressions, clicks, results, revenue, frequency}; or run `mm import metrics <file>`.",
      ],
      act: [
        "Plan: `mm run media-buyer --client <slug> --input '{\"mode\":\"plan\"}'`, then build the campaign in Meta Ads PAUSED exactly as planned, upload approved creatives, and ask for activation.",
        "Optimise: `mm run media-buyer --client <slug> --input '{\"mode\":\"optimize\",\"targetCostPerResult\":250}'`. Apply 'pause' decisions directly (A1). Send 'scale' above the daily cap and any activation for approval. Send 'refresh_creative' to Studio.",
      ],
    },
    evidence: ["03-paid-acquisition", "09-analytics-attribution"],
  },
  input: Input,

  async gather(ctx, input) {
    const ready = await ctx.store.list<Asset>(
      "assets",
      (a) => a.kind === "ad" && a.gate.status === "passed" && (a.approval.status === "approved" || a.approval.status === "auto") && !a.live,
    );
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const metrics = await ctx.store.list<MetricRow>("metrics", (m) => m.channel === "meta" && m.date >= since);
    return { ready, metrics, mode: input.mode };
  },

  think(ctx, input, ev) {
    if (input.mode !== "plan") return undefined;
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Strategist first.");
    const cap = ctx.cap("dailySpend", ctx.machine?.budgets.dailyCap ?? 0);
    return {
      name: "media-buyer.plan",
      schema: Plan,
      system: system(ctx, "Media Buyer, a paid social lead", ["paid", "analytics"], [
        "Broad targeting with genuinely diverse creative is the main lever on Meta (Andromeda). No interest stacking; exclusions only (existing customers for acquisition).",
        "Prefer one consolidated campaign/ad set with 15-20+ live concepts over many small ad sets.",
        `Daily budget must not exceed ${cap || "the client's daily cap"} ${ctx.client.currency}.`,
        "For India lead gen, consider Click-to-WhatsApp with an instant qualification flow.",
        "The conversion event must be the real business event (purchase, qualified lead), sent via pixel + Conversions API.",
      ]),
      prompt: [
        `Campaign: ${input.campaign}. Objective: ${input.objective}.`,
        asJson("approved_ads", ev.ready.map((a) => ({ id: a.id, title: a.title, motivation: a.tags.motivation, format: a.tags.format }))),
        asJson("strategy_channels", strategy.channels),
        asJson("geo", ctx.client.geo),
      ].join("\n\n"),
    };
  },

  async finish(ctx, input, ev, plan) {
    if (input.mode === "optimize") {
      if (!input.targetCostPerResult) throw new Error("optimize needs targetCostPerResult");
      const decisions = adDecisions(ev.metrics, input.targetCostPerResult);
      // Bayesian guard: only scale an ad that is probably the best, not just lucky.
      const pb = probBestCost(decisions.map((d) => ({ id: d.entityId, spend: d.spend, results: d.results })));
      for (const d of decisions) {
        const v = verdict(pb[d.entityId] ?? 0, d.results);
        (d as typeof d & { probBest?: number }).probBest = pb[d.entityId];
        if (d.action === "scale" && v !== "winner" && v !== "leading") {
          d.action = "hold";
          d.reason += ` (held: P(best)=${((pb[d.entityId] ?? 0) * 100).toFixed(0)}%, not yet convincing)`;
        }
      }
      const applied: string[] = [];
      if (tools.hasMeta() && ctx.autonomy !== "A2" && ctx.autonomy !== "A3") {
        for (const d of decisions.filter((x) => x.action === "pause")) {
          try {
            await tools.metaSetStatus(d.entityId, "PAUSED");
            applied.push(d.entityId);
          } catch (e) {
            ctx.log(`pause ${d.entityId} failed: ${(e as Error).message}`);
          }
        }
      }
      const md = [
        `# Media Buyer · optimise · ${ctx.client.name} · ${today()}`,
        `Target cost per result: ${input.targetCostPerResult} ${ctx.client.currency}. Autonomy: ${ctx.autonomy}. Applied automatically: ${applied.length ? applied.join(", ") : "none (no token or autonomy requires approval)"}.`,
        `| action | ad | spend | results | cost/result | P(best) | reason |\n|---|---|---|---|---|---|---|\n${decisions
          .sort((a, b) => a.action.localeCompare(b.action))
          .map((d) => `| **${d.action}** | ${d.entityName || d.entityId} | ${d.spend.toFixed(0)} | ${d.results} | ${d.costPerResult?.toFixed(0) ?? "-"} | ${(((d as typeof d & { probBest?: number }).probBest ?? 0) * 100).toFixed(0)}% | ${d.reason} |`)
          .join("\n")}`,
      ].join("\n\n");
      writeFile(ctx.path("out", "media-buyer", `${today()}-optimize.md`), md);
      return { decisions, applied };
    }

    const p = Plan.parse(plan);
    const cap = ctx.cap("dailySpend", ctx.machine?.budgets.dailyCap ?? Infinity);
    if (cap && p.dailyBudget > cap) p.dailyBudget = cap;
    // Readiness gate: no campaign is created while the funnel leaks.
    const gate = readinessGate(ctx, "spend");
    let created: unknown;
    const account = ctx.client.accounts.meta_ad_account;
    if (gate.open && input.createPaused && tools.hasMeta() && account) {
      created = await tools.metaCreatePausedCampaign(account, p.campaignName, input.objective);
    }
    if (!gate.open) p.launchChecklist.unshift(...gate.reasons.map((r) => `BLOCKED by readiness: ${r}`));
    const asset = makeAsset(ctx, "media-buyer", {
      kind: "campaign_plan",
      channel: "meta",
      title: p.campaignName,
      body: `${p.structure}\nDaily: ${p.dailyBudget} ${ctx.client.currency}\nAudience: ${p.audience}\nExclusions: ${p.exclusions.join(", ")}\nEvent: ${p.conversionEvent}\nTest: ${p.testPlan}`,
      meta: { ...p, created, gate },
      approval: { status: "pending", level: "A2" },
    });
    await ctx.store.insert("assets", asset);
    writeFile(
      ctx.path("out", "media-buyer", `${today()}-${input.campaign}-plan.md`),
      `# ${p.campaignName}\n\n${asset.body}\n\nAds: ${p.adIds.join(", ")}\n\n## Launch checklist\n${p.launchChecklist.map((c) => `- [ ] ${c}`).join("\n")}\n`,
    );
    return { plan: p, created, gate };
  },

  summarize: (o) =>
    o.decisions
      ? `${o.decisions.length} ad decisions, ${o.applied?.length ?? 0} applied`
      : `plan ${o.plan?.campaignName} @ ${o.plan?.dailyBudget}/day${o.gate && !o.gate.open ? " · BLOCKED by readiness gate" : ""}`,
});
