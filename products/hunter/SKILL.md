---
name: mm-hunter
description: Marketing Magic Hunter. Find accounts showing buying signals and write short, segment-specific outbound sequences for a human to edit and approve. Use when asked to run hunter for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Hunter

**Job:** Find accounts showing buying signals and write short, segment-specific outbound sequences for a human to edit and approve.

Default autonomy **A2** · default schedule `0 8 * * 1-5 (signals) · sequences on-demand`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Clay: search-companies / search-contacts for the ICP with signals (funding, new marketing leader, marketing hires, job changes of past champions); save to inputs/hunter/clay.json
- Apollo: apollo_organizations_job_postings for marketing roles at ICP accounts; apollo_website_visitors_domain_aggregates if tracking is installed; save to inputs/hunter/apollo.json
- Verify emails (apollo_email_validation_validate) before any sequence. Bounce > 2% pauses everything.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/hunter/`. The product reads every file there.

## 3. Run
- Run `mm run hunter --client <slug>`.
- A human edits each sequence. Then create it in Apollo (apollo_sequences_create) on warmed secondary domains only, max 15-25 sends per mailbox per day.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/hunter-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/strategy.json, client.icp, inputs/hunter/* (Clay/Apollo exports)
- Writes: assets(kind=sequence) always A2, out/hunter/<date>.md
- Connectors: Clay (search, enrichment, signals), Apollo (people/org search, enrichment, validation, sequences, website visitors), Gmail (replies)
- Headless APIs: APOLLO_API_KEY
- Evidence: playbooks/04-outbound-leadgen.md, playbooks/10-ai-native-marketing-ops.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
