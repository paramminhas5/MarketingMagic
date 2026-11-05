---
name: mm-lifecycle
description: Marketing Magic Lifecycle. Write the automated flows that turn every captured contact into revenue: welcome, cart, drop, post-event, nurture, win-back. Use when asked to run lifecycle for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Lifecycle

**Job:** Write the automated flows that turn every captured contact into revenue: welcome, cart, drop, post-event, nurture, win-back.

Default autonomy **A1** · default schedule `on-demand (flows) · runs are event-driven in the sending tool`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Nothing extra; the product reads what it needs from the client workspace.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/lifecycle/`. The product reads every file there.

## 3. Run
- Run `mm run lifecycle --client <slug>`.
- After approval, build each flow in the sending tool. WhatsApp templates need Meta approval; submit utility vs marketing as labelled.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/lifecycle-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/strategy.json, client playbook
- Writes: assets(kind=flow), out/lifecycle/<date>.md
- Connectors: Klaviyo (when connected), WhatsApp BSP: Interakt/AiSensy/Gupshup (when connected), Gmail (interim)
- Headless APIs: none
- Evidence: playbooks/06-lifecycle-retention.md, playbooks/05-conversion.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
