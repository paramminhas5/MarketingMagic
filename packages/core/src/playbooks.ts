// The Phase 1 research lives in /playbooks. Products pull the sections they need
// into their system prompts, so the evidence travels with every decision.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./workspace.ts";

export const PLAYBOOK_FILES = {
  synthesis: "00-synthesis.md",
  demand: "01-demand-creation.md",
  inbound: "02-inbound-seo-geo.md",
  paid: "03-paid-acquisition.md",
  outbound: "04-outbound-leadgen.md",
  conversion: "05-conversion.md",
  lifecycle: "06-lifecycle-retention.md",
  social: "07-social-short-form.md",
  positioning: "08-positioning-messaging.md",
  analytics: "09-analytics-attribution.md",
  aiOps: "10-ai-native-marketing-ops.md",
} as const;
export type PlaybookKey = keyof typeof PLAYBOOK_FILES;

export function playbook(keys: PlaybookKey[], maxChars = 9000): string {
  return keys
    .map((k) => {
      const p = join(repoRoot(), "playbooks", PLAYBOOK_FILES[k]);
      if (!existsSync(p)) return "";
      return `<playbook name="${k}">\n${readFileSync(p, "utf8").slice(0, maxChars)}\n</playbook>`;
    })
    .filter(Boolean)
    .join("\n\n");
}
