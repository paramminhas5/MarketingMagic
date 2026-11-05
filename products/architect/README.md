# Architect (`@mm/architect`)

Design the client's machine: which products run, on what schedule, with what autonomy and caps.

Standalone: `npm start -w @mm/architect -- --client <slug> [--input '<json>']` or `mm run architect --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A2 |
| Default schedule | `on-demand (onboarding) + monthly` |
| Reads | client.yaml<br>research/strategy.json<br>product manifests |
| Writes | machine.yaml<br>out/schedules.md<br>assets(kind=machine) for approval |
| Connectors | Scheduled tasks (to install the schedules once machine.yaml is approved) |
| Headless APIs | - |
| Evidence | [10-ai-native-marketing-ops](../../playbooks/10-ai-native-marketing-ops.md)<br>[00-synthesis](../../playbooks/00-synthesis.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "monthlyPaid": {
      "description": "Monthly paid media budget in the client's currency",
      "type": "number"
    },
    "dailyCap": {
      "type": "number"
    },
    "approvers": {
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
