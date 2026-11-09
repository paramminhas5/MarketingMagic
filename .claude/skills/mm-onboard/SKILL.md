---
name: mm-onboard
description: Onboard a new client into Marketing Magic, or re-run research for an existing one. Researches the market with connectors, writes the strategy and builds the client's machine (which products run, when, with what caps). Use when the user says "add a client", "onboard X", "set up the engine for X" or "redo the research for X".
---

# Onboard a client

1. **Create the workspace** (skip if it exists): `npx mm new <slug> --url <https://...>`
   Intake will fill client.yaml from the site on the first onboard step. If the client's code is available, clone it
   and set `audit.codebase` in client.yaml so Intake and the Auditor can read it. If the site isn't reachable from
   the engine, save its main pages into `clients/<slug>/inputs/intake/` and `inputs/auditor/`.

2. **Gather evidence** into `clients/<slug>/inputs/scout/` (one file per source, JSON or Markdown, keep URLs):
   - Ahrefs: site-explorer-metrics, organic-keywords, organic-competitors for the client URL
   - Ahrefs Brand Radar or web search: who gets cited in AI answers for the category
   - Semrush: domain_overview, competitors_research
   - Meta Ads: ads_library_search for each competitor and the category keyword (client's country)
   - Web search: reviews, Reddit and community threads; copy verbatim customer phrases with links

3. **Run the pipeline:** `npx mm onboard --client <slug> --objective "<goal>" --monthly <budget> --daily <cap>`
   It runs Intake → Scout → Strategist → Architect → Auditor → Planner and resumes from the first missing step. With no API key each step
   pends: answer the pending file (you are the model), `npx mm submit <pending> <answer.json>`, then run
   `npx mm onboard` again until the machine is written.

4. **Hand over:** show `research/market-brief.md`, `research/strategy.md`, `machine.yaml`, `research/readiness.md`,
   `out/opening-playbook.md` and `research/test-plan.md`, plus `out/intake-questions.md`. The strategy and machine wait in
   `npx mm approvals`. The daily autopilot task (`npx mm autopilot`) picks the client up automatically; no new task needed.

Never invent evidence. Anything you could not verify goes in the brief's `unverified` list.
