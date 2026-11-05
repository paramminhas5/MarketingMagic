# Strategist (`@mm/strategist`)

Decide what to say, to whom, where, and how to test it: positioning, motivation matrix, offers, channel plan.

Standalone: `npm start -w @mm/strategist -- --client <slug> [--input '<json>']` or `mm run strategist --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A2 |
| Default schedule | `on-demand (onboarding, new campaign) + monthly review` |
| Reads | research/market-brief.json<br>learnings |
| Writes | research/strategy.json<br>research/strategy.md<br>assets(kind=strategy) for approval |
| Connectors | Google Drive / Claude Docs (to share the strategy doc) |
| Headless APIs | - |
| Evidence | [08-positioning-messaging](../../playbooks/08-positioning-messaging.md)<br>[00-synthesis](../../playbooks/00-synthesis.md)<br>[03-paid-acquisition](../../playbooks/03-paid-acquisition.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "objective": {
      "description": "e.g. 'sell 300 tickets for Dec 13' or 'book 10 qualified calls a month'",
      "type": "string"
    },
    "offer": {
      "type": "string"
    },
    "budgetNote": {
      "type": "string"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
