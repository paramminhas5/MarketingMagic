# What the engine can guarantee

Marketing is not trading. In trading every edge gets priced in by people trying to beat you. In marketing most actions change the outcome directly, and a large share of them work almost every time because they recover demand you already have. The engine is organised around three tiers.

## 1. Near-certain: fix leaks before buying traffic
The **Auditor** checks every client's funnel against known, evidence-backed leaks and refuses to unlock paid spend or cold email until the blockers pass.

| Category | Checks | Why (playbooks/) |
|---|---|---|
| tracking | Meta pixel / LinkedIn Insight / Google Ads tag for the platforms the strategy pays for, server-side Conversions API, analytics | Platforms optimise on the events you send (03) |
| capture | "How did you hear about us" on every form, email capture, WhatsApp entry (India) | Software credited search 79%, buyers said 3% (09) |
| response | Leads reach the engine, acknowledged within 10 min, hot leads alert a human | Speed-to-lead (05) |
| lifecycle | Welcome, reminder, post-event / cart / nurture flows by playbook | Flows earn many times campaign revenue per recipient (06) |
| conversion | Somewhere to convert, ad-to-page message match, page speed | 05 |
| promises | Unkept "coming soon" on money paths, known leaks | Broken promises cost trust where traffic lands |
| discoverability | llms.txt, JSON-LD, robots + sitemap | 02 |
| deliverability | Separate sending domains, SPF, DMARC, warm-up | Bulk-sender rules (04) |
| strategy | Strategy and machine approved, daily cap, ad accounts, voice samples | Guardrails |

Evidence comes from the live site, pages a Claude session saved, the client's codebase, DNS and the engine's own state. Checks are deterministic: the same funnel always gets the same verdict. A human can attest what the engine can't see (`audit.attest` in client.yaml). It writes `research/readiness.md`, `out/opening-playbook.md` (fixes ordered blockers-first and grouped by owner) and a fix kit in `out/fixes/` (pixel + CAPI notes, HDYHAU field, llms.txt, JSON-LD).

Media Buyer will not create campaigns and Hunter marks sequences "sending blocked" while the relevant gate is locked. A missing or 14-day-old audit is a locked gate.

## 2. Very likely with enough volume: find what works
You can't know which angle wins in advance, but testing enough genuinely distinct ideas finds the winners if any exist. The **Planner** does the arithmetic first:

- angles testable = budget ÷ (30 results × cost per result)
- whether spend clears Meta's ~50 events/week learning threshold
- mode: **test** (2+ angles), **focus** (1 angle, rotate formats inside it), or **amplify only** (paid too small to learn; boost proven organic posts)

With no history it models a range of costs for the playbook and labels them scenarios; after 10+ results it switches to observed cost with a 90% interval. Winners are called by Bayesian probability of lowest cost per result (≥90% with ≥30 results). Media Buyer's optimiser holds a "scale" until the ad is probably best, not just lucky.

## 3. Not guaranteed: demand itself
Whether enough people want the offer at that price, platform changes, and small budgets. The engine is honest about these: the Planner says when paid can't learn, and the Analyst only calls winners on significant data.

## Commitments and proof
`machine.yaml` lists **commitments**: inputs the engine controls (ad concepts, voice drafts, posts, pages, sequences, flows, leads answered in 10 min, audits, memos). **Proof** reports every week: commitments met, leaks fixed since the last audit, owned audience growth, outcomes against research benchmarks, and how long approvals have been waiting.

## Autopilot
One scheduled task runs `mm tick --all` daily. The tick runs whatever is due per `machine.yaml`, skips production until strategy and machine are approved, skips spend while the gate is locked, and skips analysis when there's no data.
