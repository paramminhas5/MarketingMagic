---
name: mm-gatekeeper
description: Marketing Magic Gatekeeper. Check every asset before it ships: brand rules, AI tells, duplicate creative, unsupported claims, policy risk, and route it to auto or human approval. Use when asked to run gatekeeper for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Gatekeeper

**Job:** Check every asset before it ships: brand rules, AI tells, duplicate creative, unsupported claims, policy risk, and route it to auto or human approval.

Default autonomy **A0** · default schedule `after every production run + 0 * * * * sweep`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Nothing extra; the product reads what it needs from the client workspace.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/gatekeeper/`. The product reads every file there.

## 3. Run
- Run `mm run gatekeeper --client <slug>` after any product creates assets. Then `mm approvals` shows what needs a human.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/gatekeeper-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: assets(gate=pending), assets(live or queued), client.yaml brand + voices, machine autonomy
- Writes: assets.gate, assets.approval (auto | pending)
- Connectors: Meta Ads (ads_get_ad_preview) for a visual check of ads
- Headless APIs: none
- Evidence: playbooks/10-ai-native-marketing-ops.md, playbooks/03-paid-acquisition.md, playbooks/04-outbound-leadgen.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
