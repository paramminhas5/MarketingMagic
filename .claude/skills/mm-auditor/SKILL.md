---
name: mm-auditor
description: Marketing Magic Auditor. Check the funnel for known leaks before any money is spent, score readiness, lock or unlock paid spend and outbound, and write the fixes. Use when asked to run auditor for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Auditor

**Job:** Check the funnel for known leaks before any money is spent, score readiness, lock or unlock paid spend and outbound, and write the fixes.

Default autonomy **A0** · default schedule `5 8 * * 1 (weekly) + before every campaign`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- If the live site isn't reachable from the engine, save the homepage and main conversion pages (RSVP, signup, contact, checkout) with WebFetch or the browser as raw HTML into inputs/auditor/<page>.html.
- If the client's code is available, clone it and set client.yaml audit.codebase to its path.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/auditor/`. The product reads every file there.

## 3. Run
- Run `mm run auditor --client <slug>`.
- Share out/opening-playbook.md. Engine-owned fixes can run now; human and developer fixes go to the owner.
- Spend and outbound stay locked until blockers pass. A human can attest checks the engine can't see in client.yaml audit.attest.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/auditor-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: live site + robots/sitemap/llms.txt, inputs/auditor/* (saved pages), client.audit.codebase, machine.yaml, assets, leads, DNS for sending domains
- Writes: research/readiness.json + .md, out/fixes/*, out/opening-playbook.md
- Connectors: Web fetch / browser (save pages to inputs/auditor/ when the engine can't reach the site), The client's code repo (set audit.codebase)
- Headless APIs: none
- Evidence: playbooks/05-conversion.md, playbooks/06-lifecycle-retention.md, playbooks/09-analytics-attribution.md, playbooks/04-outbound-leadgen.md, playbooks/02-inbound-seo-geo.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
