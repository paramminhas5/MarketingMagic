// A product is a standalone unit with one job. Every product has the same shape:
//
//   gather(ctx, input)  -> evidence     tool I/O only: files, connector exports, APIs
//   think(ctx, input, evidence) -> task  optional single LLM step with a typed answer
//   finish(ctx, input, evidence, answer) -> output   validation, store writes, actions
//
// The split is what lets a product run three ways with the same code:
//   1. headless with an API key (cron, server)
//   2. inside a Claude session with connectors (skill gathers evidence, code thinks/finishes)
//   3. with no key at all: think() is saved to out/pending/ and a Claude session answers it
import { z } from "zod";
import { existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { think, PendingLlm, jsonSchemaOf, type LlmTask } from "./llm.ts";
import { openStore, newId, type Store } from "./store.ts";
import { activeClient, clientDir, loadClient, loadMachine, stamp, writeFile } from "./workspace.ts";
import type { Autonomy, ClientProfile, Machine, ProductId, RunLog } from "./schemas.ts";

export interface Ctx {
  client: ClientProfile;
  machine?: Machine;
  store: Store;
  /** Path inside clients/<slug>/ */
  path: (...parts: string[]) => string;
  log: (msg: string) => void;
  /** Autonomy level for this product for this client */
  autonomy: Autonomy;
  /** Cap from machine.yaml for this product, if any */
  cap: (name: string, fallback: number) => number;
}

export interface ProductManifest {
  id: ProductId;
  name: string;
  /** One sentence: the single job this product does */
  job: string;
  defaultAutonomy: Autonomy;
  defaultSchedule: string;
  reads: string[];
  writes: string[];
  /** Connectors a Claude session should use to gather or act */
  connectors: string[];
  /** Optional env-keyed APIs for headless runs */
  apis: string[];
  /** Steps a Claude session follows (become SKILL.md) */
  skill: { gather: string[]; act: string[] };
  /** Research the product leans on */
  evidence: string[];
}

export interface Product<I, E, A, O> {
  manifest: ProductManifest;
  input: z.ZodType<I>;
  gather: (ctx: Ctx, input: I) => Promise<E>;
  think?: (ctx: Ctx, input: I, evidence: E) => LlmTask<A> | undefined;
  finish: (ctx: Ctx, input: I, evidence: E, answer: A | undefined) => Promise<O>;
  /** One-line summary of the output for logs and the CLI */
  summarize: (out: O) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProduct = Product<any, any, any, any>;

export function defineProduct<I, E, A, O>(p: Product<I, E, A, O>): Product<I, E, A, O> {
  return p;
}

export function makeCtx(productId: ProductId, slugArg?: string, defaultAutonomy: Autonomy = "A2"): Ctx {
  const slug = activeClient(slugArg);
  const client = loadClient(slug);
  const machine = loadMachine(slug);
  const mp = machine?.products.find((p) => p.id === productId);
  return {
    client,
    machine,
    store: openStore(slug),
    path: (...parts) => clientDir(slug, ...parts),
    log: (m) => console.log(`[${slug}/${productId}] ${m}`),
    autonomy: mp?.autonomy ?? defaultAutonomy,
    cap: (name, fallback) => mp?.caps?.[name] ?? fallback,
  };
}

export type RunResult<O> =
  | { status: "done"; output: O; summary: string }
  | { status: "pending"; pendingFile: string };

interface PendingRecord {
  product: ProductId;
  client: string;
  createdAt: string;
  input: unknown;
  evidence: unknown;
  task: { name: string; system: string; prompt: string; jsonSchema: Record<string, unknown> };
  instructions: string;
}

async function logRun(ctx: Ctx, product: ProductId, status: RunLog["status"], summary: string, ms: number, usage?: { inputTokens: number; outputTokens: number }) {
  const rec: RunLog = {
    id: newId("run"),
    client: ctx.client.slug,
    product,
    status,
    summary,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    ms,
    createdAt: new Date().toISOString(),
  };
  await ctx.store.insert("runs", rec);
}

export async function runProduct<I, E, A, O>(p: Product<I, E, A, O>, ctx: Ctx, rawInput: unknown): Promise<RunResult<O>> {
  const t0 = Date.now();
  const input = p.input.parse(rawInput ?? {});
  const evidence = await p.gather(ctx, input);
  const task = p.think?.(ctx, input, evidence);
  let answer: A | undefined;
  let usage: { inputTokens: number; outputTokens: number } | undefined;
  if (task) {
    try {
      const r = await think(task);
      answer = r.result;
      usage = r.usage;
    } catch (e) {
      if (!(e instanceof PendingLlm)) throw e;
      const file = ctx.path("out", "pending", `${p.manifest.id}-${stamp()}.json`);
      const rec: PendingRecord = {
        product: p.manifest.id,
        client: ctx.client.slug,
        createdAt: new Date().toISOString(),
        input,
        evidence,
        task: { name: task.name, system: task.system, prompt: task.prompt, jsonSchema: jsonSchemaOf(task.schema) },
        instructions:
          "Answer task.prompt under task.system. Write ONLY a JSON object matching task.jsonSchema to a file, then run: mm submit <this file> <answer.json>",
      };
      writeFile(file, JSON.stringify(rec, null, 2));
      await logRun(ctx, p.manifest.id, "pending_llm", `waiting: ${file}`, Date.now() - t0);
      return { status: "pending", pendingFile: file };
    }
  }
  const output = await p.finish(ctx, input, evidence, answer);
  const summary = p.summarize(output);
  await logRun(ctx, p.manifest.id, "done", summary, Date.now() - t0, usage);
  return { status: "done", output, summary };
}

/** Complete a pending thinking step with an answer produced by a Claude session. */
export async function submitPending<I, E, A, O>(
  resolve: (id: ProductId) => Product<I, E, A, O>,
  pendingFile: string,
  answerJson: unknown,
): Promise<{ output: O; summary: string; product: ProductId; client: string }> {
  if (!existsSync(pendingFile)) throw new Error(`No pending file at ${pendingFile}`);
  const rec = JSON.parse(readFileSync(pendingFile, "utf8")) as PendingRecord;
  const p = resolve(rec.product);
  const ctx = makeCtx(rec.product, rec.client, p.manifest.defaultAutonomy);
  const input = p.input.parse(rec.input);
  const task = p.think?.(ctx, input, rec.evidence as E);
  if (!task) throw new Error(`${rec.product} has no thinking step`);
  const parsed = task.schema.safeParse(answerJson);
  if (!parsed.success) throw new Error(`Answer does not match the contract:\n${z.prettifyError(parsed.error)}`);
  const output = await p.finish(ctx, input, rec.evidence as E, parsed.data);
  const summary = p.summarize(output);
  await logRun(ctx, rec.product, "done", `${summary} (session answer)`, 0);
  unlinkSync(pendingFile);
  return { output, summary, product: rec.product, client: rec.client };
}

export function pendingFiles(slug: string): string[] {
  const dir = clientDir(slug, "out", "pending");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f));
}
