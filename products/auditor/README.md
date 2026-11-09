# Auditor (`@mm/auditor`)

Check the funnel for known leaks before any money is spent, score readiness, lock or unlock paid spend and outbound, and write the fixes.

Standalone: `npm start -w @mm/auditor -- --client <slug> [--input '<json>']` or `mm run auditor --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `5 8 * * 1 (weekly) + before every campaign` |
| Reads | live site + robots/sitemap/llms.txt<br>inputs/auditor/* (saved pages)<br>client.audit.codebase<br>machine.yaml<br>assets<br>leads<br>DNS for sending domains |
| Writes | research/readiness.json + .md<br>out/fixes/*<br>out/opening-playbook.md |
| Connectors | Web fetch / browser (save pages to inputs/auditor/ when the engine can't reach the site)<br>The client's code repo (set audit.codebase) |
| Headless APIs | - |
| Evidence | [05-conversion](../../playbooks/05-conversion.md)<br>[06-lifecycle-retention](../../playbooks/06-lifecycle-retention.md)<br>[09-analytics-attribution](../../playbooks/09-analytics-attribution.md)<br>[04-outbound-leadgen](../../playbooks/04-outbound-leadgen.md)<br>[02-inbound-seo-geo](../../playbooks/02-inbound-seo-geo.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "offline": {
      "default": false,
      "description": "Skip live fetches and DNS; use saved pages, codebase and engine state only",
      "type": "boolean"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
