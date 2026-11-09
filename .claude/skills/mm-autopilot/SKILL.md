---
name: mm-autopilot
description: Run the Marketing Magic machine for every client: execute what's due, finish pending thinking steps, and send a digest. Use for the daily scheduled task or when asked to "run the engine", "run the machine" or "do today's marketing".
---

# Autopilot

1. `npx mm tick --all`. It runs every product that's due per each client's machine.yaml.
2. For each file in `clients/*/out/pending/`: you are the model. Read it, answer `task.prompt` under `task.system` with JSON matching `task.jsonSchema`, save it, then `npx mm submit <pending> <answer.json>`. Gather extra evidence with connectors first if the product's SKILL.md says so.
3. `npx mm tick --all` again so dependent steps continue (e.g. Gatekeeper after new assets).
4. For each client: `npx mm readiness --client <slug>` and `npx mm approvals --client <slug>`.
5. Commit and push. Email Param a short digest per client: what ran, readiness score and whether spend is unlocked, what's waiting for approval, anything blocked.

Never work around a locked gate. Never post as anyone, and never invent results.

To set it up: `npx mm autopilot` prints the scheduled-task prompt. One task covers all clients.
