# Proof (`@mm/proof`)

Weekly report of commitments vs delivered, leaks fixed, owned audience growth, benchmark gaps and where a human is the bottleneck.

Standalone: `npm start -w @mm/proof -- --client <slug> [--input '<json>']` or `mm run proof --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `33 8 * * 1 (weekly)` |
| Reads | machine.yaml commitments/caps<br>assets<br>leads<br>metrics<br>learnings<br>runs<br>readiness history |
| Writes | out/proof/<date>.md<br>out/proof/<date>.json |
| Connectors | Gmail (send the report) |
| Headless APIs | - |
| Evidence | [09-analytics-attribution](../../playbooks/09-analytics-attribution.md)<br>[00-synthesis](../../playbooks/00-synthesis.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "days": {
      "default": 7,
      "type": "integer",
      "minimum": 1,
      "maximum": 31
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
