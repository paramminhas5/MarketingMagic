// The readiness gate other products consult before spending money or sending
// cold email. A missing or stale audit is a closed gate.
import { existsSync, readFileSync } from "node:fs";
import { Readiness } from "./schemas.ts";
import type { Ctx } from "./product.ts";

export const AUDIT_MAX_AGE_DAYS = 14;

export function readinessGate(ctx: Ctx, gate: "spend" | "outbound"): { open: boolean; reasons: string[]; score?: number } {
  const p = ctx.path("research", "readiness.json");
  if (!existsSync(p)) return { open: false, reasons: ["No readiness audit yet. Run `mm run auditor`."] };
  const r = Readiness.parse(JSON.parse(readFileSync(p, "utf8")));
  const ageDays = (Date.now() - Date.parse(r.at)) / 864e5;
  if (ageDays > AUDIT_MAX_AGE_DAYS) return { open: false, reasons: [`Readiness audit is ${ageDays.toFixed(0)} days old. Re-run \`mm run auditor\`.`], score: r.score };
  const open = gate === "spend" ? r.spendUnlocked : r.outboundUnlocked;
  const reasons = r.checks
    .filter((c) => c.gates.includes(gate) && c.severity === "blocker" && (c.status === "fail" || c.status === "unknown"))
    .map((c) => `${c.title}: ${c.fix}`);
  return { open, reasons: open ? [] : reasons, score: r.score };
}
