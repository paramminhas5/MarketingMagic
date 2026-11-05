# Outbound and Lead Gen

> Phase 1 research, compiled 5 Nov 2026. Evidence window 2025-2026. Every claim cites its source; full links in sources.md.

## Top plays

| # | Play | Evidence | Fit | Effort / Impact |
|---|---|---|---|---|
| 1 | **Deliverability first (SPF, DKIM, DMARC; spam under 0.1%; one-click unsubscribe)** | Google/Yahoo (Feb 2024): spam rate under 0.3%, target 0.1%. Microsoft announced Apr 30, 2025, enforced May 5, 2025 (550 5.7.515). Google moved to permanent rejections (550-5.7.26) in Nov 2025. Applies at 5,000+ emails/day. | B2B service | Low / Critical |
| 2 | **Signal-triggered outreach (job change, funding, hiring, site visits)** | Clay case studies: Sendoso 20% higher positive replies and $1M+ pipeline; Oyster 4x accounts reached. Common Room's Florin Tatulea: 22–39% reply rates (Aug 2024). | B2B service | Medium / Very high |
| 3 | **Small, segmented lists** | Instantly 2026: average reply 3.43%, top quartile 5.5%+, top 10% 10.7%+ via micro-segmentation. Average Hunter sequence went to 449 people. | B2B | Medium / High |
| 4 | **Human-edited, AI-assisted copy** | Hunter State of Email Outreach 2026 (31M emails sent in 2025): manually edited emails beat fully automated ones by 18% on reply rate (5.2% vs 4.4%). 69% of decision-makers say AI use bothers them "unless the output feels genuinely human." | B2B | Low / High |
| 5 | **4–7 touch sequences** | Instantly: 58% of replies from step 1, 42% from follow-ups. Belkins (7.53M emails): step 1 41.4% of replies; step 3 booked more meetings than steps 1 and 2 combined. | B2B | Low / High |
| 6 | **Short emails (50–125 words)** | Mailforge/Instantly (via Martal): about 50% higher reply rates than longer formats. | B2B | Low / Medium |
| 7 | **Waterfall enrichment and verification** | Instantly: bounces under 2%, complaints under 0.3%. Practitioners: 15–25 cold emails per mailbox per day (Cold Outbound Playbook). | B2B | Low / High |
| 8 | **Multichannel signal plays (email + LinkedIn + Clay)** | Reachly (agency-reported): Primal 8% positive replies, 85+ SQLs, 6 deals, 4.57x ROI in 6 months, 35% lower CAC. | B2B service | Medium / High (self-reported) |
| 9 | **LinkedIn engagement before the DM** | Van der Blom: commenting shapes your "interest graph"; post 2–4 times a week. No hard DM reply data found. | B2B | Medium / Medium |
| 10 | **Re-engage closed-lost accounts and former champions** | PandaDoc uses Clay to find "winnable" closed-lost accounts, reports 5x ROI on Clay. JollyMarketer's 6.3x job-change claim is unverified. | B2B | Low / High |

## Dead or overrated
- **Volume blasting static lists.** Belkins: 0.45% reply per email sent across 7.53M emails. Benchmarks fall yearly (Instantly 3.43% in 2025 vs older 5–8.5%).
- **Unauthenticated single-domain sending.** Since May 2025 non-compliant mail is *rejected*.
- **Fully automated "AI SDR" copy with no human edit** (Hunter 2026).

## Stack
Clay (Claygent), Apollo, Instantly/Smartlead, HeyReach, Common Room/6sense, Google Postmaster Tools, Microsoft SNDS, Yahoo Sender Hub, verification tools.

## Open questions and contradictions
- **Reply benchmarks span 0.45%–4.5%** because denominators differ (Belkins per email, unique replies; Instantly all replies per email; Hunter per recipient). Verdict: plan on Hunter 2026's 4.5% average sequence reply rate, or 3% for sales-outreach sequences.
- **"15–39%" signal reply rates come from vendors and agencies** (Twelfth, Common Room, Reachly). Treat as an upper bound; target 8–12% positive.
- **Microsoft threshold.** Some guides say 0.3%; others say none is published. Verdict: no numeric threshold is published; stay under 0.1%.
