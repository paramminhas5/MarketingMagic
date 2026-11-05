// The Conductor turns a client (or a brief) into a coordinated run across products.
// Every pipeline is resumable: it checks what already exists and continues from
// the first missing step, so a pending thinking step never loses work.
import { existsSync, readFileSync } from "node:fs";
import YAML from "yaml";
import { makeCtx, runProduct, z, type ProductId, type RunResult } from "@mm/core";
import { product, ONBOARDING, PRODUCTION } from "./registry.ts";

export interface StepReport {
  product: ProductId;
  result: RunResult<unknown> | { status: "skipped"; reason: string };
}

export async function runOne(id: ProductId, slug: string, input: unknown = {}): Promise<StepReport> {
  const p = product(id);
  const ctx = makeCtx(id, slug, p.manifest.defaultAutonomy);
  const result = await runProduct(p, ctx, input);
  return { product: id, result };
}

export interface OnboardOptions {
  objective?: string;
  offer?: string;
  monthlyPaid?: number;
  dailyCap?: number;
  approvers?: string[];
  focus?: string;
}

/** scout -> strategist -> architect. Resumes from the first missing artefact. */
export async function onboard(slug: string, o: OnboardOptions = {}): Promise<StepReport[]> {
  const ctx = makeCtx("scout", slug);
  const has = {
    scout: existsSync(ctx.path("research", "market-brief.json")),
    strategist: existsSync(ctx.path("research", "strategy.json")),
    architect: existsSync(ctx.path("machine.yaml")),
  };
  const inputs: Record<string, unknown> = {
    scout: { focus: o.focus },
    strategist: { objective: o.objective, offer: o.offer, budgetNote: o.monthlyPaid ? `${o.monthlyPaid}/month paid` : undefined },
    architect: { monthlyPaid: o.monthlyPaid, dailyCap: o.dailyCap, approvers: o.approvers },
  };
  const reports: StepReport[] = [];
  for (const id of ONBOARDING) {
    if (has[id as keyof typeof has]) {
      reports.push({ product: id, result: { status: "skipped", reason: "already done" } });
      continue;
    }
    const r = await runOne(id, slug, inputs[id]);
    reports.push(r);
    if (r.result.status === "pending") break;
  }
  return reports;
}

export const Brief = z.object({
  campaign: z.string(),
  objective: z.string().optional(),
  offer: z.string().optional(),
  calendar: z.string().optional(),
  studio: z.object({ count: z.number().optional(), formats: z.array(z.string()).optional() }).optional(),
  voice: z.object({ voice: z.string().optional(), channel: z.string().optional(), count: z.number().optional(), notes: z.string().optional() }).optional(),
  pages: z.object({ offer: z.string(), source: z.string().optional(), whatsappNumber: z.string().optional() }).optional(),
  products: z.array(z.string()).optional().describe("Override which production products run"),
});
export type Brief = z.infer<typeof Brief>;

export function loadBrief(path: string): Brief {
  const raw = readFileSync(path, "utf8");
  return Brief.parse(path.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw));
}

/** Production products enabled in machine.yaml, then Gatekeeper. Pending steps don't block the others. */
export async function campaign(slug: string, brief: Brief): Promise<StepReport[]> {
  const ctx = makeCtx("studio", slug);
  const enabled = new Set(ctx.machine?.products.filter((p) => p.enabled).map((p) => p.id) ?? PRODUCTION);
  const wanted = (brief.products as ProductId[] | undefined) ?? PRODUCTION.filter((id) => enabled.has(id));
  const inputs: Partial<Record<ProductId, unknown>> = {
    studio: { campaign: brief.campaign, offer: brief.offer, ...brief.studio },
    voice: { ...brief.voice },
    social: { calendar: brief.calendar },
    search: {},
    lifecycle: {},
    hunter: {},
  };
  const reports: StepReport[] = [];
  for (const id of wanted) {
    try {
      reports.push(await runOne(id, slug, inputs[id] ?? {}));
    } catch (e) {
      reports.push({ product: id, result: { status: "skipped", reason: (e as Error).message } });
    }
  }
  if (brief.pages) reports.push(await runOne("pages", slug, brief.pages));
  reports.push(await runOne("gatekeeper", slug, {}));
  return reports;
}

/** The daily loop: triage leads, sweep the gate, write the numbers. */
export async function cycle(slug: string, targetCostPerResult?: number): Promise<StepReport[]> {
  const out: StepReport[] = [];
  for (const [id, input] of [
    ["lead-desk", {}],
    ["gatekeeper", {}],
    ["analyst", { targetCostPerResult }],
  ] as [ProductId, unknown][]) {
    try {
      out.push(await runOne(id, slug, input));
    } catch (e) {
      out.push({ product: id, result: { status: "skipped", reason: (e as Error).message } });
    }
  }
  return out;
}
