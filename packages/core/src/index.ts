export * from "./schemas.ts";
export * from "./workspace.ts";
export * from "./store.ts";
export * from "./llm.ts";
export * from "./product.ts";
export * from "./prompt.ts";
export * from "./playbooks.ts";
export * from "./rules.ts";
export * from "./benchmarks.ts";
export * from "./stats.ts";
export * from "./cron.ts";
export * from "./gate.ts";
export * as tools from "./tools.ts";
export { z } from "zod";

import type { Asset, AssetKind, Autonomy, ProductId } from "./schemas.ts";
import type { Ctx } from "./product.ts";
import { newId } from "./store.ts";

/** Asset kinds that always need a human, whatever the machine says. */
export const ALWAYS_HUMAN: AssetKind[] = ["strategy", "machine", "sequence", "seeding_brief"];

export function makeAsset(
  ctx: Ctx,
  product: ProductId,
  a: Pick<Asset, "kind" | "channel" | "title" | "body"> & Partial<Omit<Asset, "id" | "client" | "product" | "createdAt">>,
): Asset {
  const level: Autonomy = ALWAYS_HUMAN.includes(a.kind) || (a.voice && a.voice !== "brand" && a.voice !== "creator") ? "A2" : ctx.autonomy;
  return {
    id: newId(a.kind),
    client: ctx.client.slug,
    product,
    voice: "brand",
    tags: {},
    aiLevel: "ai",
    meta: {},
    gate: { status: "pending", reasons: [] },
    approval: { status: "pending", level },
    createdAt: new Date().toISOString(),
    ...a,
  } as Asset;
}

// Documents (market brief, strategy) live as editable JSON + Markdown in
// clients/<slug>/research/, and a copy goes to the store for history.
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "./workspace.ts";
import type { z as Z } from "zod";

export type DocKind = "market-brief" | "strategy" | "readiness" | "test-plan";

export async function saveDoc(ctx: Ctx, kind: DocKind, data: unknown, markdown: string) {
  writeFile(ctx.path("research", `${kind}.json`), JSON.stringify(data, null, 2));
  writeFile(ctx.path("research", `${kind}.md`), markdown);
  await ctx.store.insert("documents", {
    id: newId(kind),
    client: ctx.client.slug,
    kind,
    data,
    createdAt: new Date().toISOString(),
  });
}

export function loadDoc<T>(ctx: Ctx, kind: DocKind, schema: Z.ZodType<T>): T | undefined {
  const p = ctx.path("research", `${kind}.json`);
  if (!existsSync(p)) return undefined;
  return schema.parse(JSON.parse(readFileSync(p, "utf8")));
}

export function requireDoc<T>(ctx: Ctx, kind: DocKind, schema: Z.ZodType<T>, hint: string): T {
  const d = loadDoc(ctx, kind, schema);
  if (!d) throw new Error(`${ctx.client.slug} has no ${kind} yet. ${hint}`);
  return d;
}

export const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
