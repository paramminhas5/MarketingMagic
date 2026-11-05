# Scout (`@mm/scout`)

Build the factual picture of a market before anyone writes copy: competitors, audience language, search and AI-answer landscape.

Standalone: `npm start -w @mm/scout -- --client <slug> [--input '<json>']` or `mm run scout --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `on-demand (onboarding) + monthly refresh` |
| Reads | client.yaml<br>inputs/scout/* |
| Writes | research/market-brief.json<br>research/market-brief.md |
| Connectors | Ahrefs<br>Semrush<br>Meta Ads (Ad Library)<br>Web search/fetch<br>Google Drive |
| Headless APIs | META_ACCESS_TOKEN (Ad Library) |
| Evidence | [01-demand-creation](../../playbooks/01-demand-creation.md)<br>[02-inbound-seo-geo](../../playbooks/02-inbound-seo-geo.md)<br>[08-positioning-messaging](../../playbooks/08-positioning-messaging.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "focus": {
      "description": "Optional angle, e.g. 'ticketed events in Bengaluru'",
      "type": "string"
    },
    "competitors": {
      "description": "URLs or names to add to the client's list",
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
