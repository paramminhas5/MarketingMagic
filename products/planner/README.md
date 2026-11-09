# Planner (`@mm/planner`)

Turn the paid budget into an honest test plan: how many angles it can test to a conclusion, how long a decision takes, and when paid can only amplify.

Standalone: `npm start -w @mm/planner -- --client <slug> [--input '<json>']` or `mm run planner --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `9 8 1 * * (monthly) + after onboarding` |
| Reads | machine.yaml budgets<br>research/strategy.json<br>metrics (observed cost per result)<br>learnings |
| Writes | research/test-plan.json + .md |
| Connectors | - |
| Headless APIs | - |
| Evidence | [03-paid-acquisition](../../playbooks/03-paid-acquisition.md)<br>[09-analytics-attribution](../../playbooks/09-analytics-attribution.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "costPerResult": {
      "description": "Override: expected cost per primary result in client currency",
      "type": "number",
      "exclusiveMinimum": 0
    },
    "minResultsPerArm": {
      "default": 30,
      "type": "integer",
      "minimum": 10,
      "maximum": 9007199254740991
    },
    "scenarios": {
      "description": "Costs per result to model when there's no history",
      "type": "array",
      "items": {
        "type": "number",
        "exclusiveMinimum": 0
      }
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
