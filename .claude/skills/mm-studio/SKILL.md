---
name: mm-studio
description: Marketing Magic Studio. Produce genuinely distinct paid-ad concepts across the motivation matrix, with copy, scripts and ready-to-run visual prompts. Use when asked to run studio for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Studio

**Job:** Produce genuinely distinct paid-ad concepts across the motivation matrix, with copy, scripts and ready-to-run visual prompts.

Default autonomy **A1** · default schedule `0 9 * * 1 (weekly) + on fatigue/kill briefs from Analyst`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- Check `mm approvals` so you know which concepts are already live or queued.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/studio/`. The product reads every file there.

## 3. Run
- Run `mm run studio --client <slug> --input '{"count":15,"campaign":"<name>"}'`.
- For each concept with whoShouldRecord = none: generate the visual with Magnific (images_generate / video_generate) from visualPrompt; save the creation URL into the asset's meta via `mm asset <id> --meta url=<url>`.
- For founder/creator formats: send the script to that person; they record, you upload.
- Then run Gatekeeper.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/studio-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: research/strategy.json, assets(kind=ad), learnings
- Writes: assets(kind=ad, gate=pending), out/studio/<date>-<campaign>.md
- Connectors: Magnific (images, video, TTS, upscale), Canva (templated statics, resizes), Meta Ads (ads_creative_create_image_variations)
- Headless APIs: none
- Evidence: playbooks/03-paid-acquisition.md, playbooks/10-ai-native-marketing-ops.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
