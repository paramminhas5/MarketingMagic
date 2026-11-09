# Intake (`@mm/intake`)

Fill a new client's profile from their site and code so onboarding needs only a URL; anything unclear becomes a question.

Standalone: `npm start -w @mm/intake -- --client <slug> [--input '<json>']` or `mm run intake --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `on-demand (first step of onboarding)` |
| Reads | client URL (live)<br>inputs/intake/* (saved pages)<br>client.audit.codebase README/package.json |
| Writes | client.yaml (draft → filled)<br>out/intake-questions.md |
| Connectors | Web fetch / browser (save pages to inputs/intake/ if the engine can't reach the site) |
| Headless APIs | - |
| Evidence | [08-positioning-messaging](../../playbooks/08-positioning-messaging.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
