---
name: mm-proof
description: Marketing Magic Proof. Weekly report of commitments vs delivered, leaks fixed, owned audience growth, benchmark gaps and where a human is the bottleneck. Use when asked to run proof for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Proof

**Job:** Weekly report of commitments vs delivered, leaks fixed, owned audience growth, benchmark gaps and where a human is the bottleneck.

Default autonomy **A0** · default schedule `33 8 * * 1 (weekly)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Nothing extra; the product reads what it needs from the client workspace.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/proof/`. The product reads every file there.

## 3. Run
- Run `mm run proof --client <slug>` and send the report to the approvers.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/proof-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: machine.yaml commitments/caps, assets, leads, metrics, learnings, runs, readiness history
- Writes: out/proof/<date>.md, out/proof/<date>.json
- Connectors: Gmail (send the report)
- Headless APIs: none
- Evidence: playbooks/09-analytics-attribution.md, playbooks/00-synthesis.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
