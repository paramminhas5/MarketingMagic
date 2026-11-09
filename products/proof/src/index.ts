// Proof: the weekly report on what the engine promised vs what it delivered.
// Inputs are under the engine's control, so they are commitments; outcomes are
// tracked against research benchmarks. Deterministic, no model call.
import {
  defineProduct,
  z,
  median,
  compare,
  lpBenchmarkFor,
  Readiness,
  writeFile,
  today,
  type Asset,
  type Lead,
  type Learning,
  type MetricRow,
  type RunLog,
  type Machine,
} from "@mm/core";

const Input = z.object({ days: z.number().int().min(1).max(31).default(7) });

type Commitment = Machine["commitments"][number];

/** Default commitments derived from machine caps when none are written down. */
function deriveCommitments(m: Machine | undefined): Commitment[] {
  if (!m) return [];
  if (m.commitments.length) return m.commitments;
  const out: Commitment[] = [];
  const cap = (id: string, k: string) => m.products.find((p) => p.id === id && p.enabled)?.caps?.[k];
  const add = (metric: Commitment["metric"], target: number | undefined, period: Commitment["period"]) => target && out.push({ metric, target, period });
  add("ad_concepts", cap("studio", "conceptsPerWeek"), "week");
  add("voice_drafts", cap("voice", "draftsPerWeek"), "week");
  add("social_posts", cap("social", "postsPerWeek"), "week");
  add("pages", cap("search", "pagesPerMonth"), "month");
  if (m.products.find((p) => p.id === "lead-desk" && p.enabled)) out.push({ metric: "leads_answered_10min_pct", target: 100, period: "week" });
  if (m.products.find((p) => p.id === "auditor" && p.enabled)) out.push({ metric: "audits", target: 1, period: "week" });
  if (m.products.find((p) => p.id === "analyst" && p.enabled)) out.push({ metric: "memos", target: 1, period: "week" });
  return out;
}

export default defineProduct({
  manifest: {
    id: "proof",
    name: "Proof",
    job: "Weekly report of commitments vs delivered, leaks fixed, owned audience growth, benchmark gaps and where a human is the bottleneck.",
    defaultAutonomy: "A0",
    defaultSchedule: "33 8 * * 1 (weekly)",
    reads: ["machine.yaml commitments/caps", "assets", "leads", "metrics", "learnings", "runs", "readiness history"],
    writes: ["out/proof/<date>.md", "out/proof/<date>.json"],
    connectors: ["Gmail (send the report)"],
    apis: [],
    skill: { gather: [], act: ["Run `mm run proof --client <slug>` and send the report to the approvers."] },
    evidence: ["09-analytics-attribution", "00-synthesis"],
  },
  input: Input,

  async gather(ctx, input) {
    const now = Date.now();
    const since = new Date(now - input.days * 864e5).toISOString();
    const [assets, leads, metrics, learnings, runs, docs] = await Promise.all([
      ctx.store.list<Asset>("assets"),
      ctx.store.list<Lead>("leads"),
      ctx.store.list<MetricRow>("metrics"),
      ctx.store.list<Learning>("learnings"),
      ctx.store.list<RunLog>("runs"),
      ctx.store.list<{ id: string; client: string; kind: string; data: unknown; createdAt: string }>("documents", (d) => d.kind === "readiness"),
    ]);
    return { since, now, assets, leads, metrics, learnings, runs, readinessHistory: docs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) };
  },

  async finish(ctx, input, ev) {
    const inWin = (iso: string) => iso >= ev.since;
    const fresh = ev.assets.filter((a) => inWin(a.createdAt));
    const count = (pred: (a: Asset) => boolean) => fresh.filter(pred).length;
    const winLeads = ev.leads.filter((l) => inWin(l.createdAt));
    const answered10 = winLeads.filter((l) => l.ackAt && Date.parse(l.ackAt) - Date.parse(l.createdAt) <= 10 * 60000).length;
    const scale = (period: Commitment["period"]) => (period === "week" ? input.days / 7 : input.days / 30);

    const delivered: Record<Commitment["metric"], number> = {
      ad_concepts: count((a) => a.kind === "ad"),
      voice_drafts: count((a) => a.product === "voice"),
      social_posts: count((a) => a.product === "social"),
      pages: count((a) => a.kind === "page" || a.kind === "article"),
      sequences: count((a) => a.kind === "sequence"),
      flows: count((a) => a.kind === "flow"),
      leads_answered_10min_pct: winLeads.length ? Math.round((100 * answered10) / winLeads.length) : NaN,
      audits: ev.runs.filter((r) => r.product === "auditor" && r.status === "done" && inWin(r.createdAt)).length,
      memos: ev.runs.filter((r) => r.product === "analyst" && r.status === "done" && inWin(r.createdAt)).length,
    };
    const commitments = deriveCommitments(ctx.machine).map((c) => {
      const target = c.metric === "leads_answered_10min_pct" ? c.target : Math.max(1, Math.round(c.target * scale(c.period)));
      const got = delivered[c.metric];
      const status = Number.isNaN(got) ? "n/a" : got >= target ? "met" : got >= 0.7 * target ? "close" : "missed";
      return { ...c, target, delivered: got, status };
    });

    // leaks fixed: compare latest audit with the last one before the window
    const hist = ev.readinessHistory.map((d) => Readiness.parse(d.data));
    const latest = hist.at(-1);
    const before = [...hist].reverse().find((r) => r.at < ev.since) ?? (hist.length > 1 ? hist[0] : undefined);
    const prevStatus = new Map(before?.checks.map((c) => [c.id, c.status]) ?? []);
    const fixedLeaks = latest && before ? latest.checks.filter((c) => c.status === "pass" && prevStatus.get(c.id) && prevStatus.get(c.id) !== "pass") : [];
    const openLeaks = latest?.checks.filter((c) => c.status !== "pass") ?? [];

    // owned audience
    const totalContacts = ev.leads.length;
    const priorContacts = ev.leads.filter((l) => !inWin(l.createdAt)).length;
    const growthPct = priorContacts ? (100 * winLeads.length) / priorContacts : NaN;

    // outcomes vs benchmarks
    const winMetrics = ev.metrics.filter((m) => m.date >= ev.since.slice(0, 10));
    const clicks = winMetrics.reduce((a, m) => a + m.clicks, 0);
    const results = winMetrics.reduce((a, m) => a + m.results, 0);
    const spend = winMetrics.reduce((a, m) => a + m.spend, 0);
    const benchmarks = [] as { metric: string; actual: string; benchmark: string; verdict: string; source: string }[];
    if (clicks >= 100) {
      const lp = compare(lpBenchmarkFor(ctx.client.playbook), (100 * results) / clicks);
      if (lp) benchmarks.push({ metric: "Click → result rate (landing proxy)", actual: `${((100 * results) / clicks).toFixed(1)}%`, benchmark: `${lp.benchmark.value}% (${lp.benchmark.scope})`, verdict: lp.verdict, source: lp.benchmark.source });
    }

    // human bottleneck
    const pending = ev.assets.filter((a) => a.approval.status === "pending");
    const oldestDays = pending.length ? Math.max(...pending.map((a) => (ev.now - Date.parse(a.createdAt)) / 864e5)) : 0;
    const tokens = ev.runs.filter((r) => inWin(r.createdAt)).reduce((a, r) => a + r.inputTokens + r.outputTokens, 0);
    const acked = winLeads.filter((l) => l.ackAt).map((l) => (Date.parse(l.ackAt!) - Date.parse(l.createdAt)) / 60000);

    const report = {
      client: ctx.client.slug,
      window: { since: ev.since, days: input.days },
      commitments,
      leaks: { fixed: fixedLeaks.map((c) => c.title), open: openLeaks.length, score: latest?.score, previousScore: before?.score, spendUnlocked: latest?.spendUnlocked },
      audience: { total: totalContacts, newInWindow: winLeads.length, growthPct, medianAckMin: median(acked) },
      paid: { spend, results, clicks, costPerResult: results ? spend / results : null },
      benchmarks,
      learningsAdded: ev.learnings.filter((l) => inWin(l.createdAt)).map((l) => l.claim),
      bottleneck: { pendingApprovals: pending.length, oldestPendingDays: Math.round(oldestDays) },
      tokens,
    };

    const met = commitments.filter((c) => c.status === "met").length;
    const ico = { met: "✓", close: "~", missed: "✗", "n/a": "·" } as Record<string, string>;
    const md = [
      `# Proof · ${ctx.client.name} · week to ${today()}`,
      `**Commitments met ${met}/${commitments.length}** · readiness ${latest?.score ?? "-"}/100${before ? ` (was ${before.score})` : ""} · paid ${latest?.spendUnlocked ? "unlocked" : "locked"} · new contacts ${winLeads.length}${Number.isFinite(growthPct) ? ` (+${growthPct.toFixed(0)}%)` : ""}`,
      `## Commitments (inputs the engine controls)\n| | commitment | target | delivered |\n|---|---|---|---|\n${commitments.map((c) => `| ${ico[c.status]} | ${c.metric.replace(/_/g, " ")} (per ${c.period}) | ${c.target} | ${Number.isNaN(c.delivered) ? "no leads" : c.delivered} |`).join("\n") || "| | none set | | |"}`,
      `## Leaks\n${fixedLeaks.length ? `Fixed this week:\n${fixedLeaks.map((c) => `- ✓ ${c.title}`).join("\n")}\n\n` : ""}${openLeaks.length} still open. Top 3:\n${openLeaks
        .sort((a, b) => ["blocker", "major", "minor"].indexOf(a.severity) - ["blocker", "major", "minor"].indexOf(b.severity))
        .slice(0, 3)
        .map((c) => `- ${c.title} (${c.severity}, ${c.owner}): ${c.fix}`)
        .join("\n")}`,
      `## Owned audience\n${totalContacts} contacts total, ${winLeads.length} new this window. Median first acknowledgement: ${acked.length ? `${median(acked).toFixed(1)} min` : "not measured"}.`,
      spend ? `## Paid\nSpend ${spend.toFixed(0)} ${ctx.client.currency} · results ${results} · cost/result ${results ? (spend / results).toFixed(0) : "-"}` : "",
      benchmarks.length ? `## Against benchmarks\n${benchmarks.map((b) => `- ${b.metric}: ${b.actual} vs ${b.benchmark} → **${b.verdict}** (${b.source})`).join("\n")}` : "",
      report.learningsAdded.length ? `## Learned\n${report.learningsAdded.map((l) => `- ${l}`).join("\n")}` : "",
      `## Where it's waiting on a human\n${pending.length} item(s) awaiting approval${pending.length ? `, oldest ${Math.round(oldestDays)} day(s)` : ""}. ${pending.length ? "Approvals are the main thing slowing the machine." : ""}`,
      `_Run cost this window: ${tokens} tokens._`,
    ]
      .filter(Boolean)
      .join("\n\n");
    writeFile(ctx.path("out", "proof", `${today()}.md`), md);
    writeFile(ctx.path("out", "proof", `${today()}.json`), JSON.stringify(report, null, 2));
    return report;
  },

  summarize: (r) => `commitments met ${r.commitments.filter((c) => c.status === "met").length}/${r.commitments.length} · ${r.leaks.fixed.length} leaks fixed · ${r.audience.newInWindow} new contacts · ${r.bottleneck.pendingApprovals} awaiting approval`,
});

