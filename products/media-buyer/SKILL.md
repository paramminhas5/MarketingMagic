---
name: mm-media-buyer
description: Marketing Magic Media Buyer. Plan, launch (paused, for approval) and optimise paid campaigns with broad targeting, diverse creative and hard spend caps. Use when asked to run media buyer for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Media Buyer

**Job:** Plan, launch (paused, for approval) and optimise paid campaigns with broad targeting, diverse creative and hard spend caps.

Default autonomy **A1** · default schedule `30 9 * * * (daily optimise)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Optimise mode: pull last 7 days of ad-level insights with Meta Ads (ads_get_ad_entities / insights) and save to inputs/media-buyer/insights.json as rows {date, entityId, entityName, spend, impressions, clicks, results, revenue, frequency}; or run `mm import metrics <file>`.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/media-buyer/`. The product reads every file there.

## 3. Run
- Plan: `mm run media-buyer --client <slug> --input '{"mode":"plan"}'`, then build the campaign in Meta Ads PAUSED exactly as planned, upload approved creatives, and ask for activation.
- Optimise: `mm run media-buyer --client <slug> --input '{"mode":"optimize","targetCostPerResult":250}'`. Apply 'pause' decisions directly (A1). Send 'scale' above the daily cap and any activation for approval. Send 'refresh_creative' to Studio.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/media-buyer-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: assets(kind=ad, gate=passed, approved), metrics, machine caps
- Writes: assets(kind=campaign_plan), decisions in out/media-buyer/<date>.md, Meta campaigns (PAUSED)
- Connectors: Meta Ads (create campaign/ad set/ad/creative, insights, A/B + lift tests), LinkedIn/Google via Adspirer when connected
- Headless APIs: META_ACCESS_TOKEN, client.accounts.meta_ad_account
- Evidence: playbooks/03-paid-acquisition.md, playbooks/09-analytics-attribution.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
