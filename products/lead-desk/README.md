# Lead Desk (`@mm/lead-desk`)

Code 'how did you hear about us', score fit and intent, route every lead and draft a fast human reply.

Standalone: `npm start -w @mm/lead-desk -- --client <slug> [--input '<json>']` or `mm run lead-desk --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A1 |
| Default schedule | `event (lead-intake webhook) + */30 * * * * sweep` |
| Reads | leads(status=new)<br>research/strategy.json |
| Writes | leads (coded, scored, routed)<br>assets(kind=reply)<br>alerts for hot leads |
| Connectors | Gmail (reply)<br>Google Calendar (book)<br>Apollo (enrich)<br>WhatsApp BSP (when connected) |
| Headless APIs | MM_ALERT_WEBHOOK |
| Evidence | [05-conversion](../../playbooks/05-conversion.md)<br>[09-analytics-attribution](../../playbooks/09-analytics-attribution.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "lead": {
      "description": "A single lead; omit to process every lead with status 'new'",
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "source": {
          "default": "form",
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "email": {
          "type": "string"
        },
        "phone": {
          "type": "string"
        },
        "company": {
          "type": "string"
        },
        "message": {
          "type": "string"
        },
        "hdyhau": {
          "type": "string"
        },
        "utm": {
          "default": {},
          "type": "object",
          "propertyNames": {
            "type": "string"
          },
          "additionalProperties": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
