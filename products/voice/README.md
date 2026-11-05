# Voice (`@mm/voice`)

Ghostwrite for named people (founders, team) in their own voice, on a fixed set of topics, for LinkedIn, Instagram and newsletters.

Standalone: `npm start -w @mm/voice -- --client <slug> [--input '<json>']` or `mm run voice --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A2 |
| Default schedule | `0 8 * * 1 (weekly drafts)` |
| Reads | client.yaml voices<br>voice/<id>.md<br>research/strategy.json<br>assets(kind=post) |
| Writes | assets(kind=post, voice=<id>) always A2<br>out/voice/<date>-<voice>.md |
| Connectors | Google Drive / Gmail (to send drafts)<br>Claude Docs |
| Headless APIs | - |
| Evidence | [07-social-short-form](../../playbooks/07-social-short-form.md)<br>[01-demand-creation](../../playbooks/01-demand-creation.md)<br>[08-positioning-messaging](../../playbooks/08-positioning-messaging.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "voice": {
      "description": "Voice id from client.yaml; defaults to the first voice",
      "type": "string"
    },
    "channel": {
      "default": "linkedin",
      "type": "string",
      "enum": [
        "linkedin",
        "instagram",
        "newsletter",
        "x"
      ]
    },
    "count": {
      "default": 3,
      "type": "integer",
      "minimum": 1,
      "maximum": 10
    },
    "topics": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "notes": {
      "description": "Raw notes / voice-memo transcript from the person to build posts from",
      "type": "string"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
