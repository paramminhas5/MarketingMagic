---
name: mm-architect
description: Marketing Magic Architect. Design the client's machine: which products run, on what schedule, with what autonomy and caps. Use when asked to run architect for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Architect

**Job:** Design the client's machine: which products run, on what schedule, with what autonomy and caps.

Default autonomy **A2** · default schedule `on-demand (onboarding) + monthly`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Make sure research/strategy.json exists and is approved.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/architect/`. The product reads every file there.

## 3. Run
- Run `mm run architect --client <slug> --input '{"monthlyPaid":60000,"dailyCap":3000}'`.
- After approval, create one scheduled task per enabled product using the prompts in out/schedules.md.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/architect-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: client.yaml, research/strategy.json, product manifests
- Writes: machine.yaml, out/schedules.md, assets(kind=machine) for approval
- Connectors: Scheduled tasks (to install the schedules once machine.yaml is approved)
- Headless APIs: none
- Evidence: playbooks/10-ai-native-marketing-ops.md, playbooks/00-synthesis.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
