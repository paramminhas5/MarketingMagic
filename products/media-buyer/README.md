# Media Buyer (`@mm/media-buyer`)

Plan, launch (paused, for approval) and optimise paid campaigns with broad targeting, diverse creative and hard spend caps.

Standalone: `npm start -w @mm/media-buyer -- --client <slug> [--input '<json>']` or `mm run media-buyer --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A1 |
| Default schedule | `30 9 * * * (daily optimise)` |
| Reads | assets(kind=ad, gate=passed, approved)<br>metrics<br>machine caps |
| Writes | assets(kind=campaign_plan)<br>decisions in out/media-buyer/<date>.md<br>Meta campaigns (PAUSED) |
| Connectors | Meta Ads (create campaign/ad set/ad/creative, insights, A/B + lift tests)<br>LinkedIn/Google via Adspirer when connected |
| Headless APIs | META_ACCESS_TOKEN<br>client.accounts.meta_ad_account |
| Evidence | [03-paid-acquisition](../../playbooks/03-paid-acquisition.md)<br>[09-analytics-attribution](../../playbooks/09-analytics-attribution.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "mode": {
      "default": "plan",
      "type": "string",
      "enum": [
        "plan",
        "optimize"
      ]
    },
    "campaign": {
      "default": "always-on",
      "type": "string"
    },
    "objective": {
      "default": "OUTCOME_LEADS",
      "type": "string",
      "enum": [
        "OUTCOME_SALES",
        "OUTCOME_LEADS",
        "OUTCOME_ENGAGEMENT",
        "OUTCOME_TRAFFIC",
        "OUTCOME_AWARENESS"
      ]
    },
    "targetCostPerResult": {
      "description": "In client currency; required for optimize",
      "type": "number"
    },
    "createPaused": {
      "default": false,
      "description": "With META_ACCESS_TOKEN + accounts.meta_ad_account, create the campaign shell PAUSED",
      "type": "boolean"
    }
  }
}
```

## How it runs
`gather` (files, connector exports, APIs) → `think` (one typed Claude call, or a pending file for a Claude session) → `finish` (validate, write to the store and `clients/<slug>/out/`, take allowed actions). See [SKILL.md](./SKILL.md) for the connector steps.
