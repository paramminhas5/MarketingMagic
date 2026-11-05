---
name: mm-analyst
description: Marketing Magic Analyst. Turn spend, leads and self-reported attribution into a weekly memo, kill/scale calls, new learnings and briefs for the other products. Use when asked to run analyst for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Analyst

**Job:** Turn spend, leads and self-reported attribution into a weekly memo, kill/scale calls, new learnings and briefs for the other products.

Default autonomy **A0** · default schedule `0 7 * * * (daily numbers) · 0 8 * * 1 (weekly memo)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Pull last N days of ad-level Meta insights and import with `mm import metrics <file>` (rows: date, channel, entityId, entityName, spend, impressions, clicks, results, revenue, frequency).
- Apollo: apollo_analytics_sync_report for sequence reply rates; save to inputs/analyst/apollo.json

Save connector output as JSON/Markdown in `clients/<slug>/inputs/analyst/`. The product reads every file there.

## 3. Run
- Run `mm run analyst --client <slug>`.
- Send the memo; route nextBriefs to the named products (the Conductor does this in `mm cycle`).

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/analyst-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: metrics, leads, assets, learnings
- Writes: learnings, out/analyst/<date>.md
- Connectors: Meta Ads insights + lift tests, Apollo analytics, Ahrefs web analytics + GSC, Vercel analytics, Windsor.ai (when connected)
- Headless APIs: META_ACCESS_TOKEN
- Evidence: playbooks/09-analytics-attribution.md, playbooks/03-paid-acquisition.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
