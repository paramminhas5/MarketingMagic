# Pages (`@mm/pages`)

Build message-matched landing pages with a required 'how did you hear about us' field, WhatsApp entry and an A/B variant.

Standalone: `npm start -w @mm/pages -- --client <slug> [--input '<json>']` or `mm run pages --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A2 |
| Default schedule | `on-demand (per offer x source)` |
| Reads | research/strategy.json<br>client.yaml brand |
| Writes | out/pages/<slug>.html<br>assets(kind=page) |
| Connectors | Vercel (deploy)<br>Supabase (lead-intake function receives the form) |
| Headless APIs | MM_LEAD_ENDPOINT |
| Evidence | [05-conversion](../../playbooks/05-conversion.md)<br>[09-analytics-attribution](../../playbooks/09-analytics-attribution.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "offer": {
      "type": "string",
      "description": "What the page sells or captures"
    },
    "source": {
      "default": "meta",
      "type": "string",
      "enum": [
        "meta",
        "email",
        "search",
        "linkedin",
        "whatsapp",
        "organic"
      ]
    },
    "slug": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "motivationId": {
      "description": "Match the page to the ad's motivation",
      "type": "string"
    },
    "whatsappNumber": {
      "description": "E.164 without +, for a click-to-chat button",
      "type": "string"
    }
  },
  "required": [
    "offer"
  ]
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
