---
name: mm-search
description: Marketing Magic Search. Win citations in AI answers and rankings on commercial queries: target queries, page briefs, third-party seeding briefs, prompts to track. Use when asked to run search for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Search

**Job:** Win citations in AI answers and rankings on commercial queries: target queries, page briefs, third-party seeding briefs, prompts to track.

Default autonomy **A2** · default schedule `0 7 1 * * (monthly) + citation check weekly`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Ahrefs: gsc-keywords + gsc-pages for the client site (if connected), keywords-explorer-matching-terms for the category; save to inputs/search/ahrefs.json
- Ahrefs Brand Radar: AI share of voice + cited pages/domains for the category prompts; save to inputs/search/ai-citations.json
- Semrush: organic_research for top 3 competitors; save to inputs/search/semrush.json

Save connector output as JSON/Markdown in `clients/<slug>/inputs/search/`. The product reads every file there.

## 3. Run
- Run `mm run search --client <slug>`.
- Pages briefs go to Pages (landing) or get written by a human expert with AI help. Seeding briefs are for a real person to act on under their own account, with disclosure. Never post as anyone else.
- Register aiPromptsToTrack in Ahrefs Brand Radar (management-brand-radar-prompts-create).

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/search-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/market-brief.json, research/strategy.json, inputs/search/*
- Writes: assets(kind=article), assets(kind=seeding_brief) human-only, out/search/<date>.md
- Connectors: Ahrefs (keywords, Brand Radar AI share of voice, GSC), Semrush, Vercel (publish pages)
- Headless APIs: none
- Evidence: playbooks/02-inbound-seo-geo.md, playbooks/09-analytics-attribution.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
