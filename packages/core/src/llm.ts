// Every product has at most one "thinking" step: a prompt plus a zod schema for
// the answer. With ANTHROPIC_API_KEY set it calls Claude and forces structured
// output through a single tool. Without a key it throws PendingLlm, and the
// runner saves the task so a Claude session can answer it (see product.ts).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export interface LlmTask<T> {
  /** Short label for logs and pending files */
  name: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** "smart" (default) or "fast" */
  tier?: "smart" | "fast";
  maxTokens?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export class PendingLlm extends Error {
  constructor() {
    super("No ANTHROPIC_API_KEY: thinking step saved for a Claude session to complete");
  }
}

export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export async function think<T>(task: LlmTask<T>): Promise<{ result: T; usage: LlmUsage }> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.MM_LLM === "session") throw new PendingLlm();
  const client = new Anthropic();
  const model =
    task.tier === "fast"
      ? process.env.MM_MODEL_FAST ?? "claude-haiku-5-5"
      : process.env.MM_MODEL ?? "claude-sonnet-5-5";
  const res = await client.messages.create({
    model,
    max_tokens: task.maxTokens ?? 8000,
    system: task.system,
    messages: [{ role: "user", content: task.prompt }],
    tools: [
      {
        name: "submit",
        description: "Submit your complete answer. Call exactly once.",
        input_schema: jsonSchemaOf(task.schema) as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "submit" },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error(`${task.name}: model returned no structured answer`);
  const parsed = task.schema.safeParse(block.input);
  if (!parsed.success) {
    throw new Error(`${task.name}: answer failed its contract:\n${z.prettifyError(parsed.error)}`);
  }
  return {
    result: parsed.data,
    usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
  };
}
