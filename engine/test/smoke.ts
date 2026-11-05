// End-to-end smoke test with no API key: new client -> onboard (scout, strategist,
// architect) -> studio -> gatekeeper -> approvals, answering each pending
// thinking step with a fixture, exactly as a Claude session would.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import type { Asset } from "@mm/core";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const root = mkdtempSync(join(tmpdir(), "mm-smoke-"));
cpSync(join(repo, "playbooks"), join(root, "playbooks"), { recursive: true });
mkdirSync(join(root, "clients"));
cpSync(join(repo, "clients", "_template"), join(root, "clients", "_template"), { recursive: true });
process.env.MM_ROOT = root;
process.env.MM_LLM = "session";
process.env.MM_STORE = "file";

const core = await import("@mm/core");
const { onboard, runOne } = await import("../src/conductor.ts");
const { product } = await import("../src/registry.ts");

core.scaffoldClient("acme", { name: "Acme Socks", url: "http://localhost:1", playbook: "consumer" });
core.setActiveClient("acme");

const FIX: Record<string, unknown> = {
  scout: {
    summary: "Small D2C sock brand in a crowded market.",
    category: "Socks",
    competitors: [{ name: "Bombas", angle: "giving", strengths: ["brand"], weaknesses: ["price"], channels: ["meta"] }],
    audience: [{ segment: "Runners", pains: ["blisters"], desires: ["comfort"], objections: ["price"], whereTheyAre: ["strava"] }],
    languageBank: [{ phrase: "no more blisters", source: "fixture" }],
    searchLandscape: { commercialQueries: ["best running socks india"], aiAnswerGaps: [], citationSurfaces: ["reddit"] },
    opportunities: [{ opportunity: "Runner clubs", evidence: "fixture", confidence: "low" }],
    unverified: [],
  },
  strategist: {
    positioning: { competitiveAlternatives: ["cheap packs"], uniqueAttributes: ["blister-free knit"], value: ["run longer"], bestFitCustomer: "runners", marketCategory: "performance socks", statement: "Socks for runners who hate blisters." },
    motivations: [
      { id: "pain", name: "Pain relief", insight: "blisters end runs", proofPoints: ["knit"], segments: ["runners"] },
      { id: "identity", name: "Runner identity", insight: "kit signals seriousness", proofPoints: ["design"], segments: ["runners"] },
      { id: "price", name: "Value", insight: "lasts longer", proofPoints: ["warranty"], segments: ["runners"] },
    ],
    offers: [{ name: "3-pack", hypothesis: "bundles lift AOV", structure: "3 for 999", risk: "margin" }],
    channels: [{ channel: "meta", role: "demand", budgetShare: 1, kpi: "CPA", cadence: "always on" }],
    primaryMetric: { name: "cost per purchase", target: "₹300" },
    tests: [{ hypothesis: "pain beats identity", metric: "CPA", minSample: "30 purchases/arm", killRule: "2x target spend, 0 sales" }],
    risks: ["small budget"],
  },
  architect: {
    products: [
      { id: "studio", enabled: true, schedule: "0 9 * * 1", autonomy: "A1", caps: { conceptsPerWeek: 15 }, notes: "" },
      { id: "media-buyer", enabled: true, schedule: "30 9 * * *", autonomy: "A1", caps: { dailySpend: 5000 }, notes: "" },
      { id: "voice", enabled: true, schedule: "0 8 * * 1", autonomy: "A0", caps: {}, notes: "should be forced to A2" },
    ],
    kpis: [{ name: "CPA", target: "₹300" }],
    weeklyRhythm: ["Mon: new concepts", "Daily: optimise"],
    rationale: "Paid-first consumer machine.",
  },
  studio: {
    concepts: [
      { motivationId: "pain", concept: "blister map", hookType: "proof_first", format: "static", hook: "Mile 8. That's where your socks quit.", headline: "Run past mile 8", primaryText: "A knit that keeps its shape when it's wet.", cta: "Shop", script: "flat lay", visualPrompt: "worn running shoes on wet tarmac at dawn, 35mm", whoShouldRecord: "none" },
      { motivationId: "identity", concept: "club kit", hookType: "pov", format: "ugc_script", hook: "POV: your club notices your socks", headline: "Club kit", primaryText: "Made for people who log every run.", cta: "Shop", script: "selfie video", visualPrompt: "runners stretching", whoShouldRecord: "creator" },
      { motivationId: "price", concept: "cost per km", hookType: "list", format: "carousel", hook: "₹0.4 per km", headline: "Cheaper per km", primaryText: "They last 1000 km.", cta: "Shop", script: "3 slides", visualPrompt: "odometer", whoShouldRecord: "none" },
    ],
  },
};

async function finishPending(id: string, answer: unknown) {
  const files = core.pendingFiles("acme").filter((f) => f.includes(`/${id}-`));
  assert.equal(files.length, 1, `expected one pending file for ${id}`);
  return core.submitPending((pid) => product(pid), files[0], answer);
}

// onboarding: each call pends at the next step; submit and re-run
for (const step of ["scout", "strategist", "architect"]) {
  const r = await onboard("acme", { monthlyPaid: 100000, dailyCap: 3000 });
  const last = r.at(-1)!;
  assert.equal(last.product, step);
  assert.equal(last.result.status, "pending");
  const done = await finishPending(step, FIX[step]);
  console.log(`✓ ${step}: ${done.summary}`);
}
const machine = core.loadMachine("acme")!;
assert.ok(machine, "machine.yaml written");
assert.equal(machine.products.find((p) => p.id === "voice")?.autonomy, "A2", "voice is locked to A2");
assert.equal(machine.products.find((p) => p.id === "gatekeeper")?.enabled, true, "gatekeeper always on");
assert.equal(machine.products.find((p) => p.id === "media-buyer")?.caps.dailySpend, 3000, "daily cap enforced");
assert.ok(existsSync(join(root, "clients/acme/research/strategy.md")));

// production: studio -> gatekeeper
await runOne("studio", "acme", { count: 3 });
console.log(`✓ studio: ${(await finishPending("studio", FIX.studio)).summary}`);
await runOne("gatekeeper", "acme", {});
const ads = await core.openStore("acme").list<Asset>("assets", (a) => a.kind === "ad");
const gk = {
  reviews: ads.map((a, i) => ({ assetId: a.id, humanFeel: i === 0 ? 4 : 2, genericPhrases: [], unsupportedClaims: i === 2 ? ["1000 km"] : [], policyRisks: [], verdict: i === 0 ? "pass" : "fix", fix: i ? "rewrite" : undefined })),
};
console.log(`✓ gatekeeper: ${(await finishPending("gatekeeper", gk)).summary}`);
const after = await core.openStore("acme").list<Asset>("assets", (a) => a.kind === "ad");
assert.equal(after.filter((a) => a.gate.status === "passed").length, 1);
assert.equal(after.find((a) => a.gate.status === "passed")?.approval.status, "auto", "A1 brand ad auto-approved after passing");

// deterministic optimiser
const decisions = core.adDecisions(
  [
    { id: "1", client: "acme", date: "2026-11-01", channel: "meta", entityId: "ad1", entityName: "loser", spend: 800, impressions: 10000, clicks: 50, results: 0, revenue: 0 },
    { id: "2", client: "acme", date: "2026-11-01", channel: "meta", entityId: "ad2", entityName: "winner", spend: 2400, impressions: 50000, clicks: 900, results: 12, revenue: 0 },
  ],
  300,
);
assert.equal(decisions.find((d) => d.entityId === "ad1")?.action, "pause");
assert.equal(decisions.find((d) => d.entityId === "ad2")?.action, "scale");
console.log("✓ optimiser rules");

const runs = JSON.parse(readFileSync(join(root, "clients/acme/data/runs.json"), "utf8"));
console.log(`✓ ${runs.length} runs logged\n\nSMOKE TEST PASSED (${root})`);
