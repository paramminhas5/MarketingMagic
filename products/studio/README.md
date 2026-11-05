# Studio (`@mm/studio`)

Produce genuinely distinct paid-ad concepts across the motivation matrix, with copy, scripts and ready-to-run visual prompts.

Standalone: `npm start -w @mm/studio -- --client <slug> [--input '<json>']` or `mm run studio --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A1 |
| Default schedule | `0 9 * * 1 (weekly) + on fatigue/kill briefs from Analyst` |
| Reads | research/strategy.json<br>assets(kind=ad)<br>learnings |
| Writes | assets(kind=ad, gate=pending)<br>out/studio/<date>-<campaign>.md |
| Connectors | Magnific (images, video, TTS, upscale)<br>Canva (templated statics, resizes)<br>Meta Ads (ads_creative_create_image_variations) |
| Headless APIs | - |
| Evidence | [03-paid-acquisition](../../playbooks/03-paid-acquisition.md)<br>[10-ai-native-marketing-ops](../../playbooks/10-ai-native-marketing-ops.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "count": {
      "default": 15,
      "type": "integer",
      "minimum": 3,
      "maximum": 50
    },
    "campaign": {
      "default": "always-on",
      "type": "string"
    },
    "offer": {
      "type": "string"
    },
    "formats": {
      "default": [
        "static",
        "video",
        "carousel",
        "founder_talking_head",
        "ugc_script"
      ],
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
