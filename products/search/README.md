# Search (`@mm/search`)

Win citations in AI answers and rankings on commercial queries: target queries, page briefs, third-party seeding briefs, prompts to track.

Standalone: `npm start -w @mm/search -- --client <slug> [--input '<json>']` or `mm run search --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A2 |
| Default schedule | `0 7 1 * * (monthly) + citation check weekly` |
| Reads | research/market-brief.json<br>research/strategy.json<br>inputs/search/* |
| Writes | assets(kind=article)<br>assets(kind=seeding_brief) human-only<br>out/search/<date>.md |
| Connectors | Ahrefs (keywords, Brand Radar AI share of voice, GSC)<br>Semrush<br>Vercel (publish pages) |
| Headless APIs | - |
| Evidence | [02-inbound-seo-geo](../../playbooks/02-inbound-seo-geo.md)<br>[09-analytics-attribution](../../playbooks/09-analytics-attribution.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "pages": {
      "default": 5,
      "type": "integer",
      "minimum": 1,
      "maximum": 20
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
