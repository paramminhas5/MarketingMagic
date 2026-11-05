// Shared prompt building so every product sees the client the same way.
import YAML from "yaml";
import type { Ctx } from "./product.ts";
import { playbook, type PlaybookKey } from "./playbooks.ts";

export const HOUSE_RULES = [
  "Be specific and opinionated. 'It depends' is not an answer.",
  "Never invent numbers, quotes, customers, results or testimonials. If evidence is missing, say so in the field meant for it.",
  "Write like a sharp human operator, not like an AI: no filler, no hype words (unlock, elevate, seamless, game-changer, revolutionize, delve), no rhetorical questions as openers.",
  "Distinct beats more: when asked for multiple ideas, each must differ in motivation or concept, not just wording.",
  "Respect the client's constraints and banned words exactly.",
];

export function clientBlock(ctx: Ctx): string {
  const c = ctx.client;
  const view = {
    name: c.name,
    url: c.url,
    playbook: c.playbook,
    description: c.description,
    geo: c.geo,
    icp: c.icp,
    offers: c.offers,
    competitors: c.competitors,
    brand: c.brand,
    voices: c.voices.map((v) => ({ id: v.id, name: v.name, role: v.role, rules: v.rules })),
    constraints: c.constraints,
    currency: c.currency,
  };
  return `<client>\n${YAML.stringify(view, { lineWidth: 0 })}</client>`;
}

export function system(ctx: Ctx, role: string, books: PlaybookKey[], extraRules: string[] = []): string {
  return [
    `You are ${role}, one product inside Marketing Magic, a marketing engine that runs for many clients. You are working for the client below.`,
    clientBlock(ctx),
    books.length ? `Evidence base (Phase 1 research, 2025-2026). Use it; cite the source name when a recommendation depends on it.\n${playbook(books)}` : "",
    `Rules:\n${[...HOUSE_RULES, ...extraRules].map((r) => `- ${r}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const asJson = (label: string, v: unknown) => `<${label}>\n${JSON.stringify(v, null, 2)}\n</${label}>`;
