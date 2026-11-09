---
name: mm-intake
description: Marketing Magic Intake. Fill a new client's profile from their site and code so onboarding needs only a URL; anything unclear becomes a question. Use when asked to run intake for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Intake

**Job:** Fill a new client's profile from their site and code so onboarding needs only a URL; anything unclear becomes a question.

Default autonomy **A0** · default schedule `on-demand (first step of onboarding)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- If the site isn't reachable from the engine, save the homepage, about, pricing/offer and contact pages as text into inputs/intake/.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/intake/`. The product reads every file there.

## 3. Run
- `mm new <slug> --url <site>` then `mm onboard` runs Intake first. Answer out/intake-questions.md and edit client.yaml if anything is off.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/intake-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: client URL (live), inputs/intake/* (saved pages), client.audit.codebase README/package.json
- Writes: client.yaml (draft → filled), out/intake-questions.md
- Connectors: Web fetch / browser (save pages to inputs/intake/ if the engine can't reach the site)
- Headless APIs: none
- Evidence: playbooks/08-positioning-messaging.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
