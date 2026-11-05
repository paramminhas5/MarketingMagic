// Deterministic rules from the research. No LLM in here on purpose: these are the
// guardrails the engine must apply the same way every time.
import type { Asset, MetricRow } from "./schemas.ts";

// ---------------------------------------------------------------- creative diversity [03]

function shingles(text: string, n = 3): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const s of A) if (B.has(s)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Meta treats near-duplicates as one creative. Reject anything too close to a live or queued asset. */
export function tooSimilar(asset: Asset, others: Asset[], threshold = 0.45): Asset | undefined {
  return others.find(
    (o) =>
      o.id !== asset.id &&
      o.kind === asset.kind &&
      (similarity(`${asset.title} ${asset.body}`, `${o.title} ${o.body}`) >= threshold ||
        (asset.tags.motivation &&
          asset.tags.motivation === o.tags.motivation &&
          asset.tags.hook &&
          asset.tags.hook === o.tags.hook &&
          asset.tags.format === o.tags.format)),
  );
}

// ---------------------------------------------------------------- copy checks

export const AI_TELLS = [
  "unlock",
  "elevate",
  "seamless",
  "game-changer",
  "game changer",
  "revolutionize",
  "delve",
  "in today's fast-paced",
  "look no further",
  "embark",
  "tapestry",
  "supercharge",
  "harness the power",
  "take it to the next level",
];

export function copyIssues(text: string, opts: { banned?: string[]; noEmDash?: boolean } = {}): string[] {
  const issues: string[] = [];
  const lower = text.toLowerCase();
  for (const w of [...AI_TELLS, ...(opts.banned ?? [])]) if (lower.includes(w.toLowerCase())) issues.push(`contains "${w}"`);
  if (opts.noEmDash && text.includes("—")) issues.push("contains an em dash");
  if ((text.match(/#\w+/g) ?? []).length > 2) issues.push("more than 2 hashtags");
  return issues;
}

export const wordCount = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------- outbound [04]

export function sequenceIssues(steps: { body: string; day: number; channel: string }[]): string[] {
  const issues: string[] = [];
  if (steps.length < 4 || steps.length > 7) issues.push(`sequence has ${steps.length} steps; research says 4-7`);
  steps.forEach((s, i) => {
    if (s.channel !== "email") return;
    const wc = wordCount(s.body);
    if (wc < 30 || wc > 140) issues.push(`step ${i + 1} is ${wc} words; aim for 50-125`);
    if (i === 0 && /https?:\/\//.test(s.body)) issues.push("step 1 contains a link (hurts deliverability)");
  });
  return issues;
}

export const DELIVERABILITY = { maxBounceRate: 0.02, maxComplaintRate: 0.001, maxPerMailboxPerDay: 25 };

// ---------------------------------------------------------------- paid optimisation [03][09]

export interface AdDecision {
  entityId: string;
  entityName: string;
  action: "pause" | "scale" | "hold" | "refresh_creative";
  reason: string;
  spend: number;
  results: number;
  costPerResult: number | null;
}

/** Aggregate rows per entity, then apply kill/scale/fatigue rules against a target cost per result. */
export function adDecisions(rows: MetricRow[], targetCost: number): AdDecision[] {
  const by = new Map<string, MetricRow[]>();
  for (const r of rows) by.set(r.entityId, [...(by.get(r.entityId) ?? []), r]);
  const out: AdDecision[] = [];
  for (const [id, rs] of by) {
    const spend = rs.reduce((a, r) => a + r.spend, 0);
    const results = rs.reduce((a, r) => a + r.results, 0);
    const impressions = rs.reduce((a, r) => a + r.impressions, 0);
    const clicks = rs.reduce((a, r) => a + r.clicks, 0);
    const cpr = results ? spend / results : null;
    const sorted = [...rs].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted.at(-1);
    const ctrNow = last && last.impressions ? last.clicks / last.impressions : 0;
    const ctrPeak = Math.max(...sorted.map((r) => (r.impressions ? r.clicks / r.impressions : 0)));
    let action: AdDecision["action"] = "hold";
    let reason = "within range; keep collecting data";
    if (spend >= 2 * targetCost && results === 0) {
      action = "pause";
      reason = `spent ${spend.toFixed(0)} (2x target) with no results`;
    } else if (cpr !== null && cpr > 1.5 * targetCost && spend >= 3 * targetCost) {
      action = "pause";
      reason = `cost per result ${cpr.toFixed(0)} is >1.5x target after meaningful spend`;
    } else if (cpr !== null && cpr <= 0.8 * targetCost && results >= 10) {
      action = "scale";
      reason = `cost per result ${cpr.toFixed(0)} is <=0.8x target over ${results} results`;
    } else if ((last?.frequency ?? 0) > 3 && ctrPeak > 0 && ctrNow < 0.7 * ctrPeak) {
      action = "refresh_creative";
      reason = `fatigue: frequency ${(last?.frequency ?? 0).toFixed(1)}, CTR down ${(100 * (1 - ctrNow / ctrPeak)).toFixed(0)}% from peak`;
    }
    void impressions;
    void clicks;
    out.push({ entityId: id, entityName: rs[0].entityName, action, reason, spend, results, costPerResult: cpr });
  }
  return out;
}

/** Minimum evidence before calling something a winner. */
export const isSignificant = (resultsPerArm: number) => resultsPerArm >= 30;
