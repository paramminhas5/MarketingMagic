# Hunter (`@mm/hunter`)

Find accounts showing buying signals and write short, segment-specific outbound sequences for a human to edit and approve.

Standalone: `npm start -w @mm/hunter -- --client <slug> [--input '<json>']` or `mm run hunter --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A2 |
| Default schedule | `0 8 * * 1-5 (signals) · sequences on-demand` |
| Reads | research/strategy.json<br>client.icp<br>inputs/hunter/* (Clay/Apollo exports) |
| Writes | assets(kind=sequence) always A2<br>out/hunter/<date>.md |
| Connectors | Clay (search, enrichment, signals)<br>Apollo (people/org search, enrichment, validation, sequences, website visitors)<br>Gmail (replies) |
| Headless APIs | APOLLO_API_KEY |
| Evidence | [04-outbound-leadgen](../../playbooks/04-outbound-leadgen.md)<br>[10-ai-native-marketing-ops](../../playbooks/10-ai-native-marketing-ops.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "segment": {
      "description": "Focus segment; default: let Hunter pick from signals",
      "type": "string"
    },
    "apolloFilters": {
      "description": "Headless only: Apollo people search filters",
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {}
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
