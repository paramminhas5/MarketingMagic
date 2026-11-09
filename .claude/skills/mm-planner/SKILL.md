---
name: mm-planner
description: Marketing Magic Planner. Turn the paid budget into an honest test plan: how many angles it can test to a conclusion, how long a decision takes, and when paid can only amplify. Use when asked to run planner for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Planner

**Job:** Turn the paid budget into an honest test plan: how many angles it can test to a conclusion, how long a decision takes, and when paid can only amplify.

Default autonomy **A0** · default schedule `9 8 1 * * (monthly) + after onboarding`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- If there are recent results, import them first: `mm import metrics <file>` (Meta insights rows).

Save connector output as JSON/Markdown in `clients/<slug>/inputs/planner/`. The product reads every file there.

## 3. Run
- Run `mm run planner --client <slug>`. Studio and Media Buyer follow the plan's arm count and decision rules.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/planner-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: machine.yaml budgets, research/strategy.json, metrics (observed cost per result), learnings
- Writes: research/test-plan.json + .md
- Connectors: none
- Headless APIs: none
- Evidence: playbooks/03-paid-acquisition.md, playbooks/09-analytics-attribution.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
