---
name: mm-voice
description: Marketing Magic Voice. Ghostwrite for named people (founders, team) in their own voice, on a fixed set of topics, for LinkedIn, Instagram and newsletters. Use when asked to run voice for a client (Iterate, Cats Can Dance or any client in clients/).
---

# Voice

**Job:** Ghostwrite for named people (founders, team) in their own voice, on a fixed set of topics, for LinkedIn, Instagram and newsletters.

Default autonomy **A2** · default schedule `0 8 * * 1 (weekly drafts)`. The client's `machine.yaml` overrides both.

## 1. Pick the client
`mm use <slug>` or pass `--client <slug>` to every command. Clients live in `clients/`.

## 2. Gather (with connectors)
- If the person left notes or a voice memo transcript, pass it via --input notes.
- Keep voice/<id>.md fresh: paste 10-20 of their best real posts or messages there.

Save connector output as JSON/Markdown in `clients/<slug>/inputs/voice/`. The product reads every file there.

## 3. Run
- Run `mm run voice --client <slug> --input '{"voice":"param","count":3}'`.
- Email the drafts to the person. They edit and post themselves. Record their final text with `mm approve <id> --final <file>` so the edit distance trains the next run.

If there is no `ANTHROPIC_API_KEY`, the thinking step is saved to `clients/<slug>/out/pending/voice-*.json`. Read it, answer `task.prompt` under `task.system` with JSON that matches `task.jsonSchema`, save it, and run `mm submit <pending> <answer.json>`.

## Contract
- Reads: client.yaml voices, voice/<id>.md, research/strategy.json, assets(kind=post)
- Writes: assets(kind=post, voice=<id>) always A2, out/voice/<date>-<voice>.md
- Connectors: Google Drive / Gmail (to send drafts), Claude Docs
- Headless APIs: none
- Evidence: playbooks/07-social-short-form.md, playbooks/01-demand-creation.md, playbooks/08-positioning-messaging.md

## Rules that never change
- Never post as someone who isn't a real, consenting person. Never invent reviews, results or testimonials.
- Anything under a real person's name, any new spend, any new outbound sequence goes to `mm approvals` first.
- Respect the caps in `machine.yaml`.
