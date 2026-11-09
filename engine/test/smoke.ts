// End-to-end smoke test with no API key: new client -> onboard (scout, strategist,
// architect) -> studio -> gatekeeper -> approvals, answering each pending
// thinking step with a fixture, exactly as a Claude session would.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import type { Asset, Lead } from "@mm/core";

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

// ---------------------------------------------------------------- readiness gate
const { writeFileSync: wf, mkdirSync: md } = await import("node:fs");
md(join(root, "clients/acme/inputs/auditor"), { recursive: true });
wf(
  join(root, "clients/acme/inputs/auditor/home.html"),
  `<html><script>fbq('init','123');fbq('track','PageView')</script><form><input type="email" name="email"/><label>How did you hear about us?</label><textarea name="hdyhau"></textarea></form><a href="https://wa.me/91999">WhatsApp</a></html>`,
);
let audit = await runOne("auditor", "acme", { offline: true });
assert.equal(audit.result.status, "done");
let gate = core.readinessGate(core.makeCtx("media-buyer", "acme"), "spend");
assert.equal(gate.open, false, "spend locked before approvals");
assert.ok(gate.reasons.some((r) => r.includes("Strategy approved")));
console.log(`✓ auditor locks spend: ${gate.reasons.length} blockers`);

// approve strategy + machine, wire the lead endpoint, re-audit
const store = core.openStore("acme");
for (const a of await store.list<Asset>("assets", (x) => x.kind === "strategy" || x.kind === "machine")) {
  await store.update<Asset>("assets", a.id, { approval: { ...a.approval, status: "approved", at: new Date().toISOString() } });
}
process.env.MM_LEAD_ENDPOINT = "https://example.test/lead";
audit = await runOne("auditor", "acme", { offline: true });
gate = core.readinessGate(core.makeCtx("media-buyer", "acme"), "spend");
assert.equal(gate.open, true, `spend unlocked once blockers pass: ${gate.reasons.join("; ")}`);
const readiness = JSON.parse(readFileSync(join(root, "clients/acme/research/readiness.json"), "utf8"));
assert.ok(readiness.checks.find((c: { id: string }) => c.id === "capture.hdyhau").status === "pass");
assert.ok(existsSync(join(root, "clients/acme/out/opening-playbook.md")));
console.log(`✓ auditor unlocks spend at ${readiness.score}/100`);

// attestation turns an unknown into a pass
const YAML = (await import("yaml")).default;
const cy = YAML.parse(readFileSync(join(root, "clients/acme/client.yaml"), "utf8"));
cy.audit = { ...(cy.audit ?? {}), attest: { "tracking.capi": "server events live via Shopify" } };
wf(join(root, "clients/acme/client.yaml"), YAML.stringify(cy));
await runOne("auditor", "acme", { offline: true });
const r2 = JSON.parse(readFileSync(join(root, "clients/acme/research/readiness.json"), "utf8"));
assert.equal(r2.checks.find((c: { id: string }) => c.id === "tracking.capi").status, "pass");
console.log("✓ attestation respected");

// ---------------------------------------------------------------- planner
const plan = await runOne("planner", "acme", {});
assert.equal(plan.result.status, "done");
const tp = JSON.parse(readFileSync(join(root, "clients/acme/research/test-plan.json"), "utf8"));
assert.ok(tp.scenarios.length >= 3 && ["test", "focus", "amplify_only"].includes(tp.recommendation.mode));
const capacity = core.testCapacity({ budget: 9000, costPerResult: 100 });
assert.equal(capacity.armsTestable, 3);
console.log(`✓ planner: ${tp.recommendation.mode}, ${tp.recommendation.armsThisMonth} arms`);

// ---------------------------------------------------------------- stats + cron
const pb = core.probBestCost([{ id: "a", spend: 3000, results: 30 }, { id: "b", spend: 3000, results: 12 }]);
assert.ok(pb.a > 0.95, `clear winner detected (${pb.a})`);
assert.equal(core.verdict(pb.a, 30), "winner");
assert.equal(core.verdict(0.7, 5), "too_early");
const monday = new Date("2026-11-09T05:00:00Z"); // 10:30 IST Monday
assert.equal(core.isDue("13 9 * * 1", new Date("2026-11-02T05:00:00Z"), monday), true);
assert.equal(core.isDue("13 9 * * 1", new Date("2026-11-09T04:00:00Z"), monday), false);
assert.equal(core.isDue("on-demand", undefined, monday), false);
console.log("✓ probability-best and cron");

// ---------------------------------------------------------------- autopilot
const { tick } = await import("../src/autopilot.ts");
const items = await tick({ clients: ["acme"], dryRun: true, now: new Date(Date.now() + 8 * 864e5) });
assert.ok(items.some((i) => i.product === "studio" && i.action === "run"), "studio due after a week once approved");
console.log(`✓ tick: ${items.filter((i) => i.action === "run").map((i) => i.product).join(", ")} due`);

// ---------------------------------------------------------------- proof
const proofRun = await runOne("proof", "acme", {});
assert.equal(proofRun.result.status, "done");
const pr = JSON.parse(readFileSync(join(root, `clients/acme/out/proof/${core.today()}.json`), "utf8"));
assert.ok(pr.commitments.some((c: { metric: string }) => c.metric === "ad_concepts"), "commitments derived from caps");
console.log(`✓ proof: ${(proofRun.result as { summary: string }).summary}`);

// ---------------------------------------------------------------- intake (URL-only client)
core.scaffoldClient("newco", { name: "newco", url: "http://localhost:1", playbook: "consumer", draft: true });
const ob = await onboard("newco", {});
assert.equal(ob.at(-1)!.product, "intake");
await finishPendingFor("newco", "intake", {
  name: "NewCo",
  playbook: "b2b_service",
  description: "NewCo builds payroll software for Indian startups.",
  geo: ["India"],
  icp: "Founders of 10-100 person startups",
  offers: [{ name: "Payroll", description: "Monthly payroll" }],
  competitors: [],
  voices: [{ id: "asha", name: "Asha", role: "Founder" }],
  tone: "Plain",
  colors: [],
  currency: "INR",
  constraints: [],
  auditPages: ["pricing"],
  questions: ["What does it cost?"],
});
const nc = core.loadClient("newco");
assert.equal(nc.draft, false);
assert.equal(nc.playbook, "b2b_service");
assert.deepEqual(nc.audit.pages, ["pricing"]);
console.log("✓ intake fills a URL-only client");

async function finishPendingFor(slug: string, id: string, answer: unknown) {
  const files = core.pendingFiles(slug).filter((f) => f.includes(`/${id}-`));
  assert.equal(files.length, 1);
  return core.submitPending((pid) => product(pid), files[0], answer);
}

// leads feed: conversions import once, and response times fill in on a later import
{
  const { execFileSync } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  const cli = join(repo, "engine", "src", "cli.ts");
  const feed = join(root, "feed.json");
  const now = Date.now();
  const row = (id: string, source: string, extra: Record<string, unknown> = {}) => ({ id, source, email: `${id}@example.test`, created_at: new Date(now - 6e5).toISOString(), heard_from: "a friend", ...extra });
  writeFileSync(feed, JSON.stringify([row("order_1", "ticket_paid", { acked_at: new Date(now - 5.5e5).toISOString() }), row("contact_1", "contact")]));
  const mmRun = (...a: string[]) => execFileSync(process.execPath, ["--import", "tsx", cli, ...a, "--client", "acme"], { env: { ...process.env, MM_ROOT: root }, encoding: "utf8" });
  mmRun("import", "feed", feed);
  writeFileSync(feed, JSON.stringify([row("contact_1", "contact", { responded_at: new Date(now - 3e5).toISOString() })]));
  const out = mmRun("import", "feed", feed);
  assert.match(out, /response times added to 1/);
  const leads = await core.openStore("acme").list<Lead>("leads");
  assert.ok(leads.find((l) => l.id === "order_1")?.ackAt, "ack time from acked_at");
  assert.equal(leads.find((l) => l.id === "order_1")?.status, "won");
  assert.ok(leads.find((l) => l.id === "contact_1")?.firstResponseAt, "response time filled on re-import");
  console.log("✓ leads feed imports with speed-to-lead times");

  const { connectReport } = await import("../src/connect.ts");
  const c = await connectReport("acme");
  assert.ok(c.items.some((i) => i.area === "Leads" && i.ok === true), "lead endpoint counts as connected");
  assert.ok(existsSync(c.path));
  const r2 = JSON.parse(readFileSync(join(root, "clients/acme/research/readiness.json"), "utf8"));
  assert.ok(typeof r2.loopsScore === "number" || r2.checks.every((x: { category: string }) => x.category !== "loops"), "loops scored separately");
  console.log(`✓ mm connect lists ${c.items.filter((i) => i.ok === false).length} to-dos`);
}

const runs = JSON.parse(readFileSync(join(root, "clients/acme/data/runs.json"), "utf8"));
console.log(`✓ ${runs.length} runs logged\n\nSMOKE TEST PASSED (${root})`);
