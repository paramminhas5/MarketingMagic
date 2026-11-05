# Lifecycle (`@mm/lifecycle`)

Write the automated flows that turn every captured contact into revenue: welcome, cart, drop, post-event, nurture, win-back.

Standalone: `npm start -w @mm/lifecycle -- --client <slug> [--input '<json>']` or `mm run lifecycle --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A1 |
| Default schedule | `on-demand (flows) · runs are event-driven in the sending tool` |
| Reads | research/strategy.json<br>client playbook |
| Writes | assets(kind=flow)<br>out/lifecycle/<date>.md |
| Connectors | Klaviyo (when connected)<br>WhatsApp BSP: Interakt/AiSensy/Gupshup (when connected)<br>Gmail (interim) |
| Headless APIs | - |
| Evidence | [06-lifecycle-retention](../../playbooks/06-lifecycle-retention.md)<br>[05-conversion](../../playbooks/05-conversion.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "flows": {
      "description": "Override which flows to write, e.g. ['welcome','post_event']",
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "channels": {
      "default": [
        "email",
        "whatsapp"
      ],
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "email",
          "whatsapp",
          "sms"
        ]
      }
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
