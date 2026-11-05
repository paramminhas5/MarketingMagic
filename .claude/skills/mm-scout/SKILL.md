---
name: mm-scout
description: Marketing Magic Scout. Build the factual picture of a market before anyone writes copy: competitors, audience language, search and AI-answer landscape. Use when asked to run scout for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Scout

**Job:** Build the factual picture of a market before anyone writes copy: competitors, audience language, search and AI-answer landscape.

Default autonomy **A0** · default schedule `on-demand (onboarding) + monthly refresh`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Ahrefs: site-explorer-metrics + organic-keywords + organic-competitors for the client URL; save to inputs/scout/ahrefs.json
- Ahrefs Brand Radar (or web search of the category in ChatGPT/Perplexity-style queries): which brands and pages get cited for the client's category; save to inputs/scout/ai-answers.json
- Semrush: domain_overview + competitors_research; save to inputs/scout/semrush.json
- Meta Ads ads_library_search for each competitor and the category keyword (country of the client); save to inputs/scout/meta-ad-library.json
- Web search: reviews, Reddit/community threads and comments where the audience talks about the problem; save verbatim phrases with URLs to inputs/scout/voice-of-customer.md

Save connector output as JSON/Markdown in `clients/<slug>/inputs/scout/`. The product reads every file there.

## 3. Run
- Run `mm run scout --client <slug>`, then answer the pending thinking step if there is no API key.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/scout-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: client.yaml, inputs/scout/*
- Writes: research/market-brief.json, research/market-brief.md
- Connectors: Ahrefs, Semrush, Meta Ads (Ad Library), Web search/fetch, Google Drive
- Headless APIs: META_ACCESS_TOKEN (Ad Library)
- Evidence: playbooks/01-demand-creation.md, playbooks/02-inbound-seo-geo.md, playbooks/08-positioning-messaging.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
