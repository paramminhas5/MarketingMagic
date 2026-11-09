// Planner: turns a budget into an honest test plan. It says up front how many
// ideas the money can actually test to a conclusion, how long a decision takes,
// and when paid is too small to learn anything (so it should only amplify).
// Pure arithmetic + Bayesian estimates; no model call.
import { defineProduct, z, Strategy, MetricRow, Learning, benchmark, requireDoc, saveDoc, testCapacity } from "@mm/core";

const Input = z.object({
  costPerResult: z.number().positive().optional().describe("Override: expected cost per primary result in client currency"),
  minResultsPerArm: z.number().int().min(10).default(30),
  scenarios: z.array(z.number().positive()).optional().describe("Costs per result to model when there's no history"),
});

const LEARNING_EVENTS_PER_WEEK = benchmark("meta_learning_events")?.value ?? 50;

export interface Scenario {
  costPerResult: number;
  resultsPerMonth: number;
  armsTestable: number;
  learningPhaseOk: boolean;
}

export interface TestPlan {
  client: string;
  at: string;
  budget: { monthly: number; dailyCap: number; currency: string };
  basis: "observed" | "override" | "scenarios";
  observed?: { costPerResult: number; results: number; spend: number; low: number; high: number };
  scenarios: Scenario[];
  recommendation: {
    mode: "test" | "focus" | "amplify_only";
    armsThisMonth: number;
    motivations: string[];
    dailyPerArm: number;
    daysToDecision: number | null;
    decisionRule: string;
    killRule: string;
    structure: string;
    notes: string[];
  };
}

function interval(spend: number, results: number) {
  // 90% interval for cost per result from a Gamma(results+1, spend) rate posterior (Wilson-Hilferty approx)
  const a = results + 1;
  const q = (z: number) => a * Math.pow(1 - 1 / (9 * a) + z / (3 * Math.sqrt(a)), 3);
  return { low: spend / q(1.645), high: spend / Math.max(q(-1.645), 1e-9) };
}

export default defineProduct({
  manifest: {
    id: "planner",
    name: "Planner",
    job: "Turn the paid budget into an honest test plan: how many angles it can test to a conclusion, how long a decision takes, and when paid can only amplify.",
    defaultAutonomy: "A0",
    defaultSchedule: "9 8 1 * * (monthly) + after onboarding",
    reads: ["machine.yaml budgets", "research/strategy.json", "metrics (observed cost per result)", "learnings"],
    writes: ["research/test-plan.json + .md"],
    connectors: [],
    apis: [],
    skill: {
      gather: ["If there are recent results, import them first: `mm import metrics <file>` (Meta insights rows)."],
      act: ["Run `mm run planner --client <slug>`. Studio and Media Buyer follow the plan's arm count and decision rules."],
    },
    evidence: ["03-paid-acquisition", "09-analytics-attribution"],
  },
  input: Input,

  async gather(ctx) {
    const strategy = requireDoc(ctx, "strategy", Strategy, "Run Strategist first.");
    const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const metrics = await ctx.store.list<MetricRow>("metrics", (m) => m.date >= since && m.channel === "meta");
    const learnings = await ctx.store.list<Learning>("learnings");
    return { strategy, metrics, learnings };
  },

  async finish(ctx, input, ev) {
    const monthly = ctx.machine?.budgets.monthlyPaid ?? 0;
    const dailyCap = ctx.machine?.budgets.dailyCap ?? Math.round(monthly / 30);
    const min = input.minResultsPerArm;
    const spend = ev.metrics.reduce((a, m) => a + m.spend, 0);
    const results = ev.metrics.reduce((a, m) => a + m.results, 0);
    const observed = results >= 10 ? { costPerResult: spend / results, results, spend, ...interval(spend, results) } : undefined;
    const basis: TestPlan["basis"] = input.costPerResult ? "override" : observed ? "observed" : "scenarios";
    const central = input.costPerResult ?? observed?.costPerResult;
    // Scenario ranges are not forecasts: they span plausible costs per result for the playbook, in the client's currency.
    const GRIDS: Record<string, number[]> = { creator_media: [25, 50, 100, 200, 400], consumer: [100, 250, 500, 1000, 2000], b2b_service: [500, 1000, 2500, 5000, 10000] };
    const fx = ctx.client.currency === "INR" ? 1 : 1 / 85;
    const grid = input.scenarios ?? (central ? [central * 0.6, central, central * 1.6] : GRIDS[ctx.client.playbook].map((x) => Math.max(1, Math.round(x * fx))));
    const weekly = monthly / 4.33;
    const scenarios: Scenario[] = grid.map((c) => {
      const cap = testCapacity({ budget: monthly, costPerResult: c, minResultsPerArm: min });
      return { costPerResult: Math.round(c), resultsPerMonth: cap.resultsAffordable, armsTestable: cap.armsTestable, learningPhaseOk: weekly / c >= LEARNING_EVENTS_PER_WEEK };
    });

    // Recommendation from the central estimate, or the median scenario if there's no data yet
    const ref = central ?? grid[Math.floor(grid.length / 2)];
    const cap = testCapacity({ budget: monthly, costPerResult: ref, minResultsPerArm: min });
    const losing = new Set(ev.learnings.filter((l) => /losing|underperform|pause/i.test(l.claim)).map((l) => l.claim.toLowerCase()));
    const motivations = ev.strategy.motivations.map((m) => m.id).filter((id) => ![...losing].some((c) => c.includes(id)));
    const paidChannelShare = ev.strategy.channels.filter((c) => /meta|instagram|facebook|ads|paid|boost|linkedin|google|tiktok/i.test(c.channel)).reduce((a, c) => a + c.budgetShare, 0);

    let mode: TestPlan["recommendation"]["mode"];
    let arms: number;
    const notes: string[] = [];
    if (monthly <= 0 || paidChannelShare === 0) {
      mode = "amplify_only";
      arms = 0;
      notes.push("No paid budget in the plan: growth comes from owned, organic and outbound channels.");
    } else if (cap.armsTestable >= 2) {
      mode = "test";
      arms = Math.min(cap.armsTestable, motivations.length, 4);
      notes.push(`Testing ${arms} motivations at a time; more would split the budget too thin to call any of them.`);
    } else if (cap.armsTestable === 1) {
      mode = "focus";
      arms = 1;
      notes.push("The budget can only bring one angle to a confident result per month. Run the strongest motivation, rotate creative formats inside it, and test angles organically first (post them, boost only winners).");
    } else {
      mode = "amplify_only";
      arms = 0;
      notes.push(`At ~${Math.round(ref)} ${ctx.client.currency} per result, ${monthly} buys ~${cap.resultsAffordable} results a month: not enough to learn anything statistically. Use paid only to amplify posts that already won organically, and judge it on cost per landing-page click.`);
    }
    if (!scenarios.find((s) => s.costPerResult === Math.round(ref))?.learningPhaseOk && mode !== "amplify_only") {
      notes.push(`Below ~${LEARNING_EVENTS_PER_WEEK} optimisation events a week (Meta's learning-phase threshold; other platforms behave similarly), so expect "learning limited": keep one consolidated campaign and ad set, broad targeting, and don't edit it daily.`);
    }
    if (basis === "scenarios") notes.push("No results yet: these are scenarios, not forecasts. The plan switches to observed costs automatically after 10+ results.");
    if (observed) notes.push(`Observed cost per result ${observed.costPerResult.toFixed(0)} (90% range ${observed.low.toFixed(0)}-${observed.high.toFixed(0)}) from ${results} results.`);

    const dailyPerArm = arms ? Math.floor(Math.min(dailyCap, monthly / 30) / arms) : 0;
    const plan: TestPlan = {
      client: ctx.client.slug,
      at: new Date().toISOString(),
      budget: { monthly, dailyCap, currency: ctx.client.currency },
      basis,
      observed,
      scenarios,
      recommendation: {
        mode,
        armsThisMonth: arms,
        motivations: motivations.slice(0, Math.max(arms, 1)),
        dailyPerArm,
        daysToDecision: arms ? cap.daysPerDecision(Math.min(dailyCap, monthly / 30), arms) : null,
        decisionRule: `Call a winner when it has ≥${min} results and ≥90% probability of the lowest cost per result (Bayesian). Below that it is 'leading' or 'too early', never a winner.`,
        killRule: `Pause any ad that spends 2x the target cost with zero results, or runs >1.5x target cost after 3x target spend.`,
        structure: mode === "amplify_only" ? "No test campaigns. Boost organic winners for 3-4 days each." : "One campaign, one broad ad set per tested motivation (or one ad set with all, Advantage+), 3 distinct formats per motivation.",
        notes,
      },
    };

    const cur = ctx.client.currency;
    const md = [
      `# Test plan · ${ctx.client.name} · ${plan.at.slice(0, 10)}`,
      `Budget ${monthly} ${cur}/month, daily cap ${dailyCap}. Basis: **${basis}**.`,
      `## Recommendation: ${mode.replace("_", " ")}`,
      arms ? `Test **${arms}** motivation(s) this month: ${plan.recommendation.motivations.join(", ")}. ~${dailyPerArm} ${cur}/day each. First decision in ~${plan.recommendation.daysToDecision} days.` : "",
      plan.recommendation.notes.map((n) => `- ${n}`).join("\n"),
      `**Structure:** ${plan.recommendation.structure}`,
      `**Decision rule:** ${plan.recommendation.decisionRule}`,
      `**Kill rule:** ${plan.recommendation.killRule}`,
      `## What the budget can learn\n| cost per result | results/month | angles testable to ${min} results | clears Meta learning phase |\n|---|---|---|---|\n${scenarios.map((s) => `| ${s.costPerResult} ${cur} | ${s.resultsPerMonth} | ${s.armsTestable} | ${s.learningPhaseOk ? "yes" : "no"} |`).join("\n")}`,
      `_Learning-phase threshold: ${LEARNING_EVENTS_PER_WEEK} events/week per ad set (${benchmark("meta_learning_events")?.source})._`,
    ]
      .filter(Boolean)
      .join("\n\n");
    await saveDoc(ctx, "test-plan", plan, md);
    return plan;
  },

  summarize: (p) => `${p.recommendation.mode}: ${p.recommendation.armsThisMonth} arm(s) this month (basis ${p.basis})`,
});

