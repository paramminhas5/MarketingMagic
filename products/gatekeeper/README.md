# Gatekeeper (`@mm/gatekeeper`)

Check every asset before it ships: brand rules, AI tells, duplicate creative, unsupported claims, policy risk, and route it to auto or human approval.

Standalone: `npm start -w @mm/gatekeeper -- --client <slug> [--input '<json>']` or `mm run gatekeeper --client <slug>`.
Inside the engine it is called by the Conductor (`mm onboard`, `mm campaign`, `mm cycle`).

| | |
|---|---|
| Default autonomy | A0 |
| Default schedule | `after every production run + 0 * * * * sweep` |
| Reads | assets(gate=pending)<br>assets(live or queued)<br>client.yaml brand + voices<br>machine autonomy |
| Writes | assets.gate<br>assets.approval (auto | pending) |
| Connectors | Meta Ads (ads_get_ad_preview) for a visual check of ads |
| Headless APIs | - |
| Evidence | [10-ai-native-marketing-ops](../../playbooks/10-ai-native-marketing-ops.md)<br>[03-paid-acquisition](../../playbooks/03-paid-acquisition.md)<br>[04-outbound-leadgen](../../playbooks/04-outbound-leadgen.md) |

## Input
```json
{
  "type": "object",
  "properties": {
    "ids": {
      "description": "Asset ids; default: everything with gate=pending",
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
