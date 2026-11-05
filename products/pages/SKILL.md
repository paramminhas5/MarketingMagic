---
name: mm-pages
description: Marketing Magic Pages. Build message-matched landing pages with a required 'how did you hear about us' field, WhatsApp entry and an A/B variant. Use when asked to run pages for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Pages

**Job:** Build message-matched landing pages with a required 'how did you hear about us' field, WhatsApp entry and an A/B variant.

Default autonomy **A2** · default schedule `on-demand (per offer x source)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Know the offer, the traffic source and which ad motivation it follows.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/pages/`. The product reads every file there.

## 3. Run
- Run `mm run pages --client <slug> --input '{"offer":"...","source":"meta"}'`.
- After approval, deploy out/pages/<slug>.html with Vercel (or drop it into the client's site). Variant B is ?v=b.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/pages-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/strategy.json, client.yaml brand
- Writes: out/pages/<slug>.html, assets(kind=page)
- Connectors: Vercel (deploy), Supabase (lead-intake function receives the form)
- Headless APIs: MM_LEAD_ENDPOINT
- Evidence: playbooks/05-conversion.md, playbooks/09-analytics-attribution.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
