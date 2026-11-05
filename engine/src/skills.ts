// Generates each product's SKILL.md and README.md from its manifest (one source
// of truth), plus copies under .claude/skills/ so any Claude Code session opened
// in this repo can run the products with its connectors.
import { join } from "node:path";
import { repoRoot, writeFile, jsonSchemaOf, type AnyProduct } from "@mm/core";
import { PRODUCTS } from "./registry.ts";

function skillMd(p: AnyProduct): string {
  const m = p.manifest;
  return `---
name: mm-${m.id}
description: Marketing Magic ${m.name}. ${m.job} Use when asked to run ${m.name.toLowerCase()} for a client (Iterate, Cats Can Dance or any client in clients/).
---

# ${m.name}

**Job:** ${m.job}

Default autonomy **${m.defaultAutonomy}** · default schedule \`${m.defaultSchedule}\`. The client's \`machine.yaml\` overrides both.

## 1. Pick the client
\`mm use <slug>\` or pass \`--client <slug>\` to every command. Clients live in \`clients/\`.

## 2. Gather (with connectors)
${m.skill.gather.length ? m.skill.gather.map((g) => `- ${g}`).join("\n") : "- Nothing extra; the product reads what it needs from the client workspace."}

Save connector output as JSON/Markdown in \`clients/<slug>/inputs/${m.id}/\`. The product reads every file there.

## 3. Run
${m.skill.act.map((a) => `- ${a}`).join("\n")}

If there is no \`ANTHROPIC_API_KEY\`, the thinking step is saved to \`clients/<slug>/out/pending/${m.id}-*.json\`. Read it, answer \`task.prompt\` under \`task.system\` with JSON that matches \`task.jsonSchema\`, save it, and run \`mm submit <pending> <answer.json>\`.

## Contract
- Reads: ${m.reads.join(", ")}
- Writes: ${m.writes.join(", ")}
- Connectors: ${m.connectors.join(", ") || "none"}
- Headless APIs: ${m.apis.join(", ") || "none"}
- Evidence: ${m.evidence.map((e) => `playbooks/${e}.md`).join(", ")}

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to \`mm approvals\` first.
- Respect the caps in \`machine.yaml\`.
`;
}

function readmeMd(p: AnyProduct): string {
  const m = p.manifest;
  const input = JSON.stringify(jsonSchemaOf(p.input), null, 2);
  return `# ${m.name} (\`@mm/${m.id}\`)

${m.job}

Standalone: \`npm start -w @mm/${m.id} -- --client <slug> [--input '<json>']\` or \`mm run ${m.id} --client <slug>\`.
Inside the engine it is called by the Conductor (\`mm onboard\`, \`mm campaign\`, \`mm cycle\`).

| | |
|---|---|
| Default autonomy | ${m.defaultAutonomy} |
| Default schedule | \`${m.defaultSchedule}\` |
| Reads | ${m.reads.join("<br>")} |
| Writes | ${m.writes.join("<br>")} |
| Connectors | ${m.connectors.join("<br>") || "-"} |
| Headless APIs | ${m.apis.join("<br>") || "-"} |
| Evidence | ${m.evidence.map((e) => `[${e}](../../playbooks/${e}.md)`).join("<br>")} |

## Input
\`\`\`json
${input}
\`\`\`

## How it runs
\`gather\` (files, connector exports, APIs) → \`think\` (one typed Claude call, or a pending file for a Claude session) → \`finish\` (validate, write to the store and \`clients/<slug>/out/\`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
`;
}

export function generateSkills(): string[] {
  const root = repoRoot();
  const written: string[] = [];
  for (const p of Object.values(PRODUCTS)) {
    const id = p.manifest.id;
    const skill = skillMd(p);
    writeFile(join(root, "products", id, "SKILL.md"), skill);
    writeFile(join(root, ".claude", "skills", `mm-${id}`, "SKILL.md"), skill);
    writeFile(join(root, "products", id, "README.md"), readmeMd(p));
    written.push(id);
  }
  return written;
}
