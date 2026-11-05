# Working in Marketing Magic

This repo is a multi-client marketing engine. Read README.md for the map.

## How to operate it in a Claude session
- Pick the client first: `npx mm use <slug>` or `--client <slug>` on every command. Never mix client data.
- Each product has a skill in `.claude/skills/mm-<product>/SKILL.md`: gather evidence with connectors into
  `clients/<slug>/inputs/<product>/`, run `npx mm run <product>`, then act.
- With no ANTHROPIC_API_KEY, runs stop at a thinking step saved in `clients/<slug>/out/pending/`.
  You are the model: read the file, answer `task.prompt` under `task.system` with JSON matching
  `task.jsonSchema`, write it to a file, then `npx mm submit <pending> <answer>`.
- To onboard a new client use the `mm-onboard` skill.

## Rules
- Contracts live in `packages/core/src/schemas.ts`. Change them there; never pass prose between products.
- Never post as someone who isn't a real, consenting person. Never invent reviews, results, testimonials or numbers.
- New spend, anything in a real person's voice, and new outbound sequences need human approval (`mm approvals`).
  Campaigns are created PAUSED.
- Respect caps in `clients/<slug>/machine.yaml`.
- In Param's voice: plain, no em dashes, cut lines that exist to sound good.

## Dev
- `npm run typecheck`, `npm test` (end-to-end smoke test with fixtures, no API key needed).
- After changing a product manifest, run `npx mm skills` to regenerate SKILL.md/README.md.
