---
name: mm-lead-desk
description: Marketing Magic Lead Desk. Code 'how did you hear about us', score fit and intent, route every lead and draft a fast human reply. Use when asked to run lead desk for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Lead Desk

**Job:** Code 'how did you hear about us', score fit and intent, route every lead and draft a fast human reply.

Default autonomy **A1** · default schedule `event (lead-intake webhook) + */30 * * * * sweep`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- New leads arrive via the lead-intake function into the store; or `mm import lead <file>`.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/lead-desk/`. The product reads every file there.

## 3. Run
- Run `mm run lead-desk --client <slug>`.
- Hot leads: send the drafted reply now (Gmail) and offer two calendar slots (Google Calendar suggest_time). Nurture: hand to Lifecycle. Anything about pricing or proposals: hand to a human.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/lead-desk-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: leads(status=new), research/strategy.json
- Writes: leads (coded, scored, routed), assets(kind=reply), alerts for hot leads
- Connectors: Gmail (reply), Google Calendar (book), Apollo (enrich), WhatsApp BSP (when connected)
- Headless APIs: MM_ALERT_WEBHOOK
- Evidence: playbooks/05-conversion.md, playbooks/09-analytics-attribution.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
