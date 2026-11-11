# What each open PR is worth · Cats Can Dance · 2026-11-11
Each row scores the site as if that branch were merged and deployed. Checks that also need a setting (pixel id, migration, approval) still count as not done until it's set.
| PR | readiness | loops | paid | what it fixes |
|---|---|---|---|---|
|  Live (main) | 45 (±0) | 38 (±0) | locked | no change |
| [#27](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/27) grow: attribution for the marketing engine (how you heard, UTM, Meta pixel + CAPI) | 59 (+14) | 38 (±0) | locked | Server-side Conversions API → pass; 'How did you hear about us' on every high-intent form → pass; Known leak: WhatsApp opt-ins are collected (RSVP, crews) but nothing is sent on Wh → pass |
| [#34](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/34) Lifecycle email: welcome, reminder, thank-you | 52 (+7) | 38 (±0) | locked | Welcome flow → pass; Post-event 'next one' loop → pass |
| [#28](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/28) Points: loyalty for every night, plus invite loop | 45 (±0) | 100 (+62) | locked | Referral with a reward for both sides → pass; Loyalty that rewards coming back → pass; Something of value on day one → pass |
| [#33](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/33) weekly: 2026-11-11 | 45 (±0) | 38 (±0) | locked | no change |
| [#32](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/32) Final preview build: suite system, @ccd/ui, Artists, Host and Nights pages | 45 (±0) | 38 (±0) | locked | no change |
| [#31](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/31) upgrade: Next 15 and React 19, remove legacy write endpoints | 45 (±0) | 38 (±0) | locked | no change |
| [#30](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/30) security: forms through checked RPCs, real image hosts, CSP, School link | 45 (±0) | 38 (±0) | locked | no change |
| [#29](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/29) security: database grants, crons, secrets, headers, CI | 45 (±0) | 38 (±0) | locked | no change |
| [#25](https://github.com/paramminhas5/CatsCanDanceOct2026/pull/25) weekly: 2026-11-09 | 45 (±0) | 38 (±0) | locked | no change |
|  All of them together | 66 (+21) | 100 (+62) | locked | Server-side Conversions API → pass; 'How did you hear about us' on every high-intent form → pass; Welcome flow → pass; Post-event 'next one' loop → pass; Known leak: WhatsApp opt-ins are collected (RSVP, crews) but nothing is sent on Wh → pass; Referral with a reward for both sides → pass; Loyalty that rewards coming back → pass; Something of value on day one → pass |

## Path to 100
1. **Merge #34, #28, #27** (apply each PR's migration first, as its description says). Readiness 45 → 66, loops 38 → 100.
2. **Meta pixel sends conversion events** (developer, unlocks spend): Set NEXT_PUBLIC_META_PIXEL_ID=1033536589528805 in the host's env and redeploy. → readiness 73
3. **Every lead reaches the engine** (developer, unlocks spend and outbound): Pull the site's conversions from supabase://jybloszaucgqlbkzquqw/marketing.leads_feed into the engine (`mm import feed`, see the Lead Desk skill). Needs the feed to exist and a human OK to read lead data. → readiness 80
4. **Strategy approved by a human** (human, unlocks spend and outbound): Review research/strategy.md and approve it. → readiness 87
5. **Machine and caps approved** (human, unlocks spend and outbound): Review machine.yaml and approve it. → readiness 94
6. **No unkept 'coming soon' promises on money paths** (developer): Review the listed placeholders; most are harmless empty states. → readiness 95
7. **Hot leads alert a human** (human): Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay). → readiness 98
8. **Writing samples for Param Minhas** (human): Paste 10-20 real posts or messages by Param Minhas into voice/param.md. → readiness 100

Fixes that change what the live site shows (copy, placeholders) only count once deployed, so they can show here after the merge step.