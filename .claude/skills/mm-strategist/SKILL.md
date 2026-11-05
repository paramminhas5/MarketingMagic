---
name: mm-strategist
description: Marketing Magic Strategist. Decide what to say, to whom, where, and how to test it: positioning, motivation matrix, offers, channel plan. Use when asked to run strategist for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Strategist

**Job:** Decide what to say, to whom, where, and how to test it: positioning, motivation matrix, offers, channel plan.

Default autonomy **A2** · default schedule `on-demand (onboarding, new campaign) + monthly review`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Make sure research/market-brief.json exists (run Scout first).

Save connector output as JSON/Markdown in `clients/<slug>/inputs/strategist/`. The product reads every file there.

## 3. Run
- Run `mm run strategist --client <slug>` (answer the pending step if no API key).
- Send the strategy for approval: `mm approvals` lists it. Nothing downstream should treat it as final until approved.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/strategist-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/market-brief.json, learnings
- Writes: research/strategy.json, research/strategy.md, assets(kind=strategy) for approval
- Connectors: Google Drive / Claude Docs (to share the strategy doc)
- Headless APIs: none
- Evidence: playbooks/08-positioning-messaging.md, playbooks/00-synthesis.md, playbooks/03-paid-acquisition.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
