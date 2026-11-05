---
name: mm-social
description: Marketing Magic Social. Plan and write brand-channel content that earns reach (Reels/TikTok) and saves (carousels), tied to the strategy's pillars. Use when asked to run social for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Social

**Job:** Plan and write brand-channel content that earns reach (Reels/TikTok) and saves (carousels), tied to the strategy's pillars.

Default autonomy **A1** · default schedule `0 10 * * 5 (plans next week)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Pass upcoming events/drops via --input calendar.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/social/`. The product reads every file there.

## 3. Run
- Run `mm run social --client <slug>`.
- Generate visuals for items with a visualPrompt (Magnific/Canva).
- After Gatekeeper, schedule posts. Boost any post beating the account median on saves/shares by 2x (paid rules apply).

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/social-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/strategy.json, assets(kind=post, voice=brand)
- Writes: assets(kind=post, voice=brand), out/social/<date>.md
- Connectors: Magnific / Canva (visuals), Meta Ads (boost winning IG posts), Publishing tool TBD
- Headless APIs: none
- Evidence: playbooks/07-social-short-form.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
