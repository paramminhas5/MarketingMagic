# Analyst (`@mm/analyst`)

Turn spend, leads and self-reported attribution into a weekly memo, kill/scale calls, new learnings and briefs for the other products.

Standalone: `npm start -w @mm/analyst -- --client <slug> [--input '<json>']` or `mm run analyst --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `0 7 * * * (daily numbers) · 0 8 * * 1 (weekly memo)` |
| Reads | metrics<br>leads<br>assets<br>learnings |
| Writes | learnings<br>out/analyst/<date>.md |
| Connectors | Meta Ads insights + lift tests<br>Apollo analytics<br>Ahrefs web analytics + GSC<br>Vercel analytics<br>Windsor.ai (when connected) |
| Headless APIs | META_ACCESS_TOKEN |
| Evidence | [09-analytics-attribution](../../playbooks/09-analytics-attribution.md)<br>[03-paid-acquisition](../../playbooks/03-paid-acquisition.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "days": {
      "default": 7,
      "type": "integer",
      "minimum": 1,
      "maximum": 90
    },
    "targetCostPerResult": {
      "type": "number"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
