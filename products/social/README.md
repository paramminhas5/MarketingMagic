# Social (`@mm/social`)

Plan and write brand-channel content that earns reach (Reels/TikTok) and saves (carousels), tied to the strategy's pillars.

Standalone: `npm start -w @mm/social -- --client <slug> [--input '<json>']` or `mm run social --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A1 |
| Default schedule | `0 10 * * 5 (plans next week)` |
| Reads | research/strategy.json<br>assets(kind=post, voice=brand) |
| Writes | assets(kind=post, voice=brand)<br>out/social/<date>.md |
| Connectors | Magnific / Canva (visuals)<br>Meta Ads (boost winning IG posts)<br>Publishing tool TBD |
| Headless APIs | - |
| Evidence | [07-social-short-form](../../playbooks/07-social-short-form.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "weeks": {
      "default": 1,
      "type": "integer",
      "minimum": 1,
      "maximum": 4
    },
    "channels": {
      "default": [
        "instagram"
      ],
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "instagram",
          "tiktok",
          "youtube_shorts",
          "linkedin_page",
          "x"
        ]
      }
    },
    "calendar": {
      "description": "Events, drops or launches in this window",
      "type": "string"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
