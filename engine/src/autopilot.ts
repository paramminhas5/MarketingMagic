// Autopilot: one scheduled task runs `mm tick --all`, and the tick decides what
// is due for every client from machine.yaml schedules and the run log. This is
// what makes the engine run out of the box instead of needing a task per product.
import { existsSync, readFileSync } from "node:fs";
import {
  isCron,
  isDue,
  listClients,
  loadMachine,
  openStore,
  pendingFiles,
  readinessGate,
  makeCtx,
  type ProductId,
  type RunLog,
  type MachineProduct,
} from "@mm/core";
import { runOne, type StepReport } from "./conductor.ts";
import { CORE_DEFAULTS } from "@mm/architect";

const PRODUCERS: ProductId[] = ["studio", "voice", "social", "search", "lifecycle", "hunter", "pages"];
const ORDER: ProductId[] = ["auditor", "scout", "planner", "lead-desk", "studio", "voice", "social", "search", "lifecycle", "hunter", "media-buyer", "analyst", "proof"];

export interface TickItem {
  client: string;
  product: ProductId;
  action: "run" | "skip";
  reason: string;
  report?: StepReport;
}

function productsWithCore(slug: string): MachineProduct[] {
  const m = loadMachine(slug);
  if (!m) return [];
  const have = new Set(m.products.map((p) => p.id));
  const extra = (Object.keys(CORE_DEFAULTS) as ProductId[])
    .filter((id) => !have.has(id))
    .map((id) => ({ id, enabled: true, schedule: "on-demand", autonomy: "A0" as const, caps: {}, notes: "", ...CORE_DEFAULTS[id] }) as MachineProduct);
  return [...m.products, ...extra];
}

async function defaultInput(slug: string, id: ProductId): Promise<{ input: unknown } | { skip: string }> {
  if (id === "analyst") {
    const store = openStore(slug);
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const [m, l] = await Promise.all([store.list<{ id: string; client: string; date: string }>("metrics", (r) => r.date >= since.slice(0, 10)), store.list<{ id: string; client: string; createdAt: string }>("leads", (r) => r.createdAt >= since)]);
    if (!m.length && !l.length) return { skip: "no metrics or leads in the last 7 days; nothing to analyse" };
    return { input: {} };
  }
  if (id !== "media-buyer") return { input: {} };
  // Daily optimise needs a target; take it from the test plan's observed cost.
  const ctx = makeCtx("media-buyer", slug);
  const p = ctx.path("research", "test-plan.json");
  const plan = existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : undefined;
  const target = plan?.observed?.costPerResult;
  if (!target) return { skip: "no observed cost per result yet (needs 10+ results); nothing to optimise" };
  return { input: { mode: "optimize", targetCostPerResult: Math.round(target) } };
}

export async function tick(opts: { clients?: string[]; dryRun?: boolean; now?: Date } = {}): Promise<TickItem[]> {
  const now = opts.now ?? new Date();
  const items: TickItem[] = [];
  for (const slug of opts.clients ?? listClients()) {
    const m = loadMachine(slug);
    if (!m) {
      items.push({ client: slug, product: "architect", action: "skip", reason: "no machine.yaml yet: run `mm onboard`" });
      continue;
    }
    const runs = await openStore(slug).list<RunLog>("runs");
    const pending = pendingFiles(slug);
    const lastRun = (id: ProductId) => {
      const r = runs.filter((x) => x.product === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
      return r ? new Date(r.createdAt) : undefined;
    };
    const products = productsWithCore(slug)
      .filter((p) => p.enabled && isCron(p.schedule))
      .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
    let produced = false;
    const assets = await openStore(slug).list<{ id: string; client: string; kind: string; approval: { status: string } }>("assets");
    const approved = (k: string) => assets.some((a) => a.kind === k && a.approval.status === "approved");
    const productionAllowed = approved("strategy") && approved("machine");
    for (const p of products) {
      if (!isDue(p.schedule, lastRun(p.id), now, m.timezone)) continue;
      if (pending.some((f) => f.includes(`/${p.id}-`))) {
        items.push({ client: slug, product: p.id, action: "skip", reason: "a thinking step is already waiting (mm pending)" });
        continue;
      }
      if ((PRODUCERS.includes(p.id) || p.id === "media-buyer") && !productionAllowed) {
        items.push({ client: slug, product: p.id, action: "skip", reason: "waiting for strategy + machine approval (mm approvals)" });
        continue;
      }
      const di = await defaultInput(slug, p.id);
      if ("skip" in di) {
        items.push({ client: slug, product: p.id, action: "skip", reason: di.skip });
        continue;
      }
      if (p.id === "media-buyer" && !readinessGate(makeCtx("media-buyer", slug), "spend").open) {
        // optimise only pauses/holds, which reduces spend, so it may run while locked
        const mode = (di.input as { mode?: string }).mode;
        if (mode !== "optimize") {
          items.push({ client: slug, product: p.id, action: "skip", reason: "spend gate locked by readiness audit" });
          continue;
        }
      }
      if (opts.dryRun) {
        items.push({ client: slug, product: p.id, action: "run", reason: `due (${p.schedule})` });
        continue;
      }
      try {
        const report = await runOne(p.id, slug, di.input);
        items.push({ client: slug, product: p.id, action: "run", reason: `due (${p.schedule})`, report });
        if (PRODUCERS.includes(p.id) && report.result.status === "done") produced = true;
      } catch (e) {
        items.push({ client: slug, product: p.id, action: "skip", reason: `failed: ${(e as Error).message}` });
      }
    }
    if (produced && !opts.dryRun) {
      const report = await runOne("gatekeeper", slug, {});
      items.push({ client: slug, product: "gatekeeper", action: "run", reason: "new assets to check", report });
    }
  }
  return items;
}

export function autopilotPrompt(root: string): string {
  return `In the MarketingMagic repo (${root}): run \`npx mm tick --all\`. For every thinking step it leaves in clients/*/out/pending/, answer it as the model (read the file, write JSON matching task.jsonSchema, run \`npx mm submit <pending> <answer>\`). Then run \`npx mm tick --all\` once more so dependent steps continue. Commit and push the changes. Finally email Param a short digest: per client, what ran, what's waiting in \`npx mm approvals\`, the readiness score, and anything blocked.`;
}
