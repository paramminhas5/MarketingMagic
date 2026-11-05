# Architecture: Autonomous Marketing Engine

> Phase 2 proposal, 5 Nov 2026. Built on /research (Phase 1). Every design choice below traces to a finding; the research file is named in brackets, e.g. [03] = research/03-paid-acquisition.md.

## 0. The one-paragraph version

A Conductor turns a campaign brief into a plan, a swarm of 12 specialist agents produces and distributes work, a Gatekeeper checks everything before it touches the outside world, and an Analyst feeds results back into a shared learnings store that every agent reads before it acts. Supabase is the single system of record. The engine automates **variety and timing**, not volume of the same thing [00]. Humans stay at three surfaces only: strategy sign-off, anything published under a real person's name, and money or irreversible actions. Everything else runs on its own, and action types earn more autonomy as they prove themselves.

---

## 1. Design principles (from the research)

| # | Principle | Why | Source |
|---|---|---|---|
| P1 | **Generate distinct concepts, not variants.** Every asset carries a motivation and concept tag; near-duplicates are rejected before launch. | Meta counts look-alike ads as one creative; micro-segmented outbound beats volume. | [03], [04] |
| P2 | **People over logos.** A dedicated Voice agent writes in named humans' voices; brand pages are secondary. | Personal profiles ~2-4x company-page engagement; TLAs cheaper per landing-page click; 59% of LinkedIn AI citations are member content. | [01], [02], [03] |
| P3 | **Perceived humanity is a KPI.** A human-feel check is a Gatekeeper gate; founder-voice and cold-email copy always get a human edit. | Manually edited cold email +18% reply rate; 69% of buyers bothered by AI-feeling email; AI ads win only when they read as human. | [04], [10] |
| P4 | **Timing beats targeting.** Signal watchers and event triggers start most actions, not calendars. | Signal outbound, cart flows and sub-10-minute speed-to-lead carry the biggest lifts. | [04], [05], [06] |
| P5 | **Measure what software can't see.** Required free-text "How did you hear about us?" (HDYHAU) on every high-intent form, coded by AI, joined to every lead. | Software credited search 79%, buyers said 3%. | [09] |
| P6 | **Optimise to money, not clicks.** Primary metrics are qualified leads, new-customer CAC and revenue; CTR is diagnostic only. | Platform ROAS and TLA total CTR both mislead. | [03], [09] |
| P7 | **Owned channels compound.** Every campaign must grow a list (email, WhatsApp, newsletter) the engine controls. | Flows return 18-100x campaign revenue per recipient; social reach is collapsing. | [06], [07] |
| P8 | **Frameworks are hypotheses.** Dunford/Hormozi/JTBD generate options; tests decide. | No controlled evidence for any of them. | [08] |

---

## 2. System map

```
                         ┌──────────────────────┐
   Campaign brief ──────▶│      CONDUCTOR        │◀──── learnings + priors
                         │ plan · budget · gates │
                         └──────────┬───────────┘
                                    │
            ┌───────────── STRATEGY ┼─────────────┐
            ▼                                     ▼
        1 SCOUT  ───── market/audience brief ──▶ 2 STRATEGIST
                                                   │ positioning, motivation matrix,
                                                   │ offer, channel plan
                                   ◆ HUMAN GATE 1 (approve strategy + budget)
                                                   │
         ┌──────────────── PRODUCTION ─────────────┼──────────────────┐
         ▼               ▼               ▼          ▼                  ▼
     3 STUDIO        4 VOICE         5 SOCIAL    6 SEARCH          7 PAGES
   paid creative   founder/people   brand-channel SEO/GEO pages,   landing pages,
                   content          content       citation seeding  HDYHAU, CTWA entry
         └───────────────┴───────────────┴──────────┴──────────────────┘
                                    ▼
                          12 GATEKEEPER (QA, policy, diversity, human-feel, caps)
                                    │
                   ◆ HUMAN GATE 2 (batched one-tap approvals, only where required)
                                    │
         ┌──────────────── DISTRIBUTION ───────────┬──────────────────┐
         ▼                    ▼                    ▼                  ▼
    8 MEDIA BUYER        9 HUNTER            Social/Voice        10 LIFECYCLE
    Meta (+ LinkedIn,    signal outbound     scheduling          email · WhatsApp ·
    Google, TikTok)      Clay → Apollo                           newsletter flows
         └────────────────────┴──────────┬─────────┴──────────────────┘
                                         ▼
                                  11 LEAD DESK
                     instant reply · qualify · score · route · book
                                         │
                                         ▼
                                 ANALYST (inside 0)
                metrics · HDYHAU coding · kill/scale · weekly memo
                                         │
                                         ▼
                        LEARNINGS STORE (Supabase) ──▶ every agent reads before acting
```

Note: the Analyst is drawn inside the Conductor's loop because it closes every cycle; it is a separate agent (section 4, agent 13).

---

## 3. The Conductor: how a brief becomes a coordinated run

### 3.1 Brief schema (the only input a human must write)

```yaml
brand: cats-can-dance            # existing brand profile is loaded automatically
objective: ticket_sales          # qualified_leads | purchases | signups | meetings | tickets
offer: "Dec 13 rooftop night, early-bird ₹999"
playbook: creator_media          # consumer | b2b_service | creator_media  (from [00])
geo: [Bengaluru]
budget: { paid_total_inr: 60000, daily_cap_inr: 5000 }
deadline: 2026-12-13
target: { primary: cost_per_ticket, value_inr: 250 }
voices: [param]                  # named humans who can post
assets: [drive://ccd/event-photos, ig://catscandance]
constraints: ["no discount messaging after Dec 6"]
```

Anything missing is filled from the brand profile; anything still missing is asked once, as a single batched question.

### 3.2 Run lifecycle

| Stage | Who | Output | Gate |
|---|---|---|---|
| 1. Intake | Conductor | Normalised brief, playbook selected, priors pulled from learnings (same brand → same vertical → global) | none |
| 2. Intelligence | Scout | Market brief: competitors' live ads, audience language, search/AI-answer landscape | none |
| 3. Strategy | Strategist | Positioning, motivation matrix (5-8 motivations × segments), offer hypotheses, channel plan, budget split, success metrics, test plan | **Gate 1: human approves** |
| 4. Production | Studio, Voice, Social, Search, Pages (parallel) | Tagged asset packs | none |
| 5. QA | Gatekeeper | Pass/fail per asset, diversity score per pack | auto-reject failures |
| 6. Approval | Human | Batched approvals, only for A2 items (section 5) | **Gate 2** |
| 7. Distribution | Media Buyer, Hunter, Social, Lifecycle | Live ads, sequences, posts, flows | spend/volume caps |
| 8. Response | Lead Desk | Qualified, scored, routed leads; meetings booked | none |
| 9. Learn | Analyst | Daily actions, weekly memo, learnings written | none |
| 10. Iterate | Conductor | Re-briefs Studio/Strategist from learnings | none |

### 3.3 Orchestration mechanics

- **Task graph, not chat.** The Conductor writes a run plan to `runs` + `tasks` tables (each task: agent, inputs, depends_on, deadline, budget, autonomy level). Agents pull their own tasks and write outputs back. This makes runs resumable, auditable and parallel.
- **Contracts between agents are typed records, not prose.** Studio receives `concept_briefs` rows and emits `assets` rows; Media Buyer only reads `assets` with `gate_status = passed` and `approval_status in (approved, auto)`.
- **One brief, many brands.** Runs are scoped by `brand_id`; learnings are scoped `brand | vertical | global` so a win on SoleSearch can inform CCD as a prior, not as fact.

---

## 4. The agents

Each agent is defined once as a skill (SKILL.md: role, rules, the relevant research file, tools, output schema) so its behaviour is versioned and editable.

### 1. Scout (market and audience intelligence)
- **Role:** build the factual picture before anyone writes copy.
- **Inputs:** brief, brand profile, competitor list (or discovers one).
- **Does:** pulls competitors' live ads (Meta Ad Library), organic and paid search footprint, AI-answer share of voice, reviews/Reddit/comments language, the brand's own past performance.
- **Outputs:** `market_brief` (competitors, their angles, gaps), `language_bank` (verbatim customer phrases with source), baseline metrics.
- **Tools:** facebook_ads `ads_library_search`; Semrush (domain, organic, paid, audience); Ahrefs (site explorer, Brand Radar AI share of voice, keywords); WebSearch/WebFetch; Google Drive for brand docs.
- **Hands off to:** Strategist. **Autonomy:** full.

### 2. Strategist (positioning, offer, plan)
- **Role:** decide what to say, to whom, where, and how to test it.
- **Inputs:** market brief, language bank, learnings priors, playbook from [00].
- **Outputs:** positioning statement (competitive alternatives, unique value, best-fit customer), **motivation matrix** (the backbone of creative diversity [03]), 2-3 offer hypotheses, channel plan with budget split, test plan with primary metric and kill thresholds.
- **Tools:** Supabase, Claude Docs/Drive for the human-readable strategy doc.
- **Hands off to:** Gate 1, then all production agents. **Autonomy:** draft only; human approves once per campaign.

### 3. Studio (paid creative)
- **Role:** produce 15-50 genuinely distinct ad concepts across the motivation matrix [03].
- **Inputs:** approved strategy, concept briefs, brand kit, winning/losing concepts from learnings.
- **Does:** writes concept → hook → script/copy; generates statics, video and voiceover; builds founder/UGC-style talking-head scripts for real humans to record; produces format variants (4:5, 9:16, carousel) only after concepts are distinct.
- **Outputs:** `assets` rows tagged with motivation, concept_id, format, hook_type, voice type, ai_level.
- **Tools:** Magnific (image, video, TTS, upscale, resize, brand kit); Canva (templated statics, resize); facebook_ads `ads_creative_create_image_variations`.
- **Hands off to:** Gatekeeper → Media Buyer. **Autonomy:** full production; launch rights governed by section 5.

### 4. Voice (people-led content)
- **Role:** ghostwrite for named humans (Param first): LinkedIn posts and documents, newsletter, IG captions from the 150k page, TLA candidates.
- **Inputs:** voice corpus (embedded past writing), topic fingerprint (2-3 fixed topics per person [07]), campaign angles, Param's notes/voice memos.
- **Outputs:** 2-4 LinkedIn posts/week per voice, 1 newsletter/week, comment suggestions on target accounts' posts.
- **Rules:** first person, no hashtags beyond 2, no polls for reach, no em dashes in Param's voice, cut lines that exist to sound good [07][08].
- **Tools:** Supabase (pgvector corpus), Claude Docs, Google Drive.
- **Hands off to:** Gate 2 (always), then scheduled. **Autonomy:** draft only, permanently. Anything under a real name is approved by that person.

### 5. Social (brand channels)
- **Role:** brand-account content: carousels for saves, Reels/TikTok for reach, Shorts as redistribution [07].
- **Inputs:** strategy, Studio assets (repurposed), event/product calendar.
- **Outputs:** weekly content plan and finished posts with captions.
- **Tools:** Magnific, Canva, facebook_ads `ads_get_ig_media` / `ads_boost_ig_post` (boost winners); publishing connector TBD (section 8).
- **Autonomy:** auto-schedule from approved content pillars after the first 2 weeks; boosts follow paid rules.

### 6. Search (SEO and GEO)
- **Role:** win citations, not just rankings [02].
- **Does:** tracks AI-answer share of voice per engine; finds commercial and non-AIO queries; writes human-led, expert-edited pages (case studies with numbers, comparisons, pricing explainers, FAQs with schema); produces *seeding briefs* for third-party surfaces (Reddit threads worth answering, G2/Clutch profiles, LinkedIn articles, YouTube).
- **Outputs:** page drafts (to Pages), `citation_snapshots`, seeding briefs for humans.
- **Tools:** Ahrefs (Brand Radar, cited pages/domains, keywords, GSC data), Semrush, WebSearch, Vercel for deploy.
- **Rule:** third-party seeding is done by real people under their own accounts with disclosed affiliation. The engine finds the opportunity and drafts a starting point; it never posts as a fake user.
- **Autonomy:** research and drafts full; publishing pages is A2 until proven.

### 7. Pages (conversion surfaces)
- **Role:** landing pages and entry points that convert per traffic source [05].
- **Does:** builds one page per offer × source, message-matched to the ad concept; required HDYHAU field; WhatsApp click-to-chat entry for India; A/B tests headline/offer/form length; pushes form events to Supabase and Meta CAPI.
- **Tools:** Vercel (deploy, flags for A/B, analytics), Supabase (forms → leads), facebook_ads pixel/dataset tools.
- **Autonomy:** variants of an approved page auto; new pages A2.

### 8. Media Buyer (paid distribution)
- **Role:** run paid channels on the Andromeda model: broad targeting, many distinct creatives, platform AI for delivery [03].
- **Does:** creates campaigns **paused** → requests approval → activates; uploads Gatekeeper-passed assets; applies kill/scale rules daily; excludes existing customers from acquisition campaigns; sets up Meta conversion-lift tests monthly.
- **Tools:** facebook_ads (campaigns, ad sets, ads, creatives, audiences, insights, anomaly signals, A/B and lift experiments). Later: LinkedIn, Google, TikTok via a connector (section 8).
- **Autonomy:** see section 5; hard daily and lifetime caps per campaign.

### 9. Hunter (signal-based outbound, B2B)
- **Role:** reach accounts at the moment they show intent [04].
- **Does:** watches signals (funding, new marketing leader, marketing hires, ad-spend changes, site visits, job changes of past champions); enriches with waterfall + verification; writes 4-7 step, 50-125-word sequences per micro-segment; personal first lines from real research.
- **Tools:** Clay (search, enrichment, workspace functions), Apollo (people/org search, enrichment, email validation, sequences, website visitor tracking, analytics), Gmail for replies.
- **Deliverability guard:** secondary domains only, SPF/DKIM/DMARC, 15-25 sends/mailbox/day, auto-pause at bounce > 2% or spam complaint > 0.1% [04].
- **Autonomy:** list building full; each new sequence template A2 (human edit is the point [04]); approved sequences enrol contacts automatically within volume caps.

### 10. Lifecycle (owned channels)
- **Role:** turn every captured contact into revenue via flows, not blasts [06].
- **Flows by playbook:** consumer: welcome, cart, browse, back-in-stock/drop alert, post-purchase, win-back. B2B: nurture to booked call, no-show recovery. Creator/media: welcome automation, event drop, post-event "next one" loop, referral.
- **Tools:** gap today: Klaviyo (in connector directory) and a WhatsApp BSP (Interakt/AiSensy/Gupshup); interim via Gmail drafts + Zapier.
- **Autonomy:** flows from approved templates run automatically; new flow logic A2.

### 11. Lead Desk (speed-to-lead and qualification)
- **Role:** respond in under 10 minutes, every time [05].
- **Does:** on form/WhatsApp/email reply: instant acknowledgement; qualification via a short scripted conversation; scores on fit + intent + HDYHAU; routes hot leads to Param with a one-paragraph brief; books via calendar; logs every touch.
- **Tools:** Supabase (webhook trigger, leads), Gmail, Google Calendar, Apollo (enrich), WhatsApp BSP (gap).
- **Runtime note:** this is the one agent that must be event-driven (seconds), not scheduled (section 7).
- **Autonomy:** acknowledgements, qualification questions and booking are auto from approved scripts; pricing, proposals and anything off-script hand to a human.

### 12. Gatekeeper (QA and compliance)
- **Role:** nothing reaches the outside world without passing it.
- **Checks:** brand and voice rules; factual claims traceable to a source or the brand's own data; ad-policy and AI-content-labelling compliance per platform; **diversity score** (rejects assets too similar to live ones by embedding distance + tag overlap); human-feel review (an independent model pass that flags generic or AI-sounding copy); spend and volume caps; deliverability health; no fake testimonials, fake people, or impersonation.
- **Tools:** Supabase, the assets' own content, facebook_ads preview tools.
- **Autonomy:** full. It can block; it cannot approve A2 items.

### 13. Analyst (measurement and learning)
- **Role:** close every loop [09].
- **Does:** daily pulls (Meta insights, Apollo analytics, Vercel/Ahrefs web analytics, GSC via Ahrefs, Supabase leads/revenue); codes free-text HDYHAU into channels; computes blended and new-customer CAC; issues kill/scale recommendations to Media Buyer; writes the weekly memo; writes `learnings` rows with evidence and confidence; schedules one incrementality test a month.
- **Tools:** facebook_ads insights and lift tests, Apollo analytics, Ahrefs web analytics + GSC, Vercel analytics, Supabase; Windsor.ai once connected for cross-platform pulls.
- **Autonomy:** full for analysis; its kill/scale actions execute through Media Buyer's guardrails.

---

## 5. Autonomy model: what's automated vs human-in-the-loop

| Level | Meaning | Action classes |
|---|---|---|
| **A0 Auto** | Runs with no review | Research, analysis, drafting, asset generation, scoring, routing, internal DB writes, reports, list building, enrichment |
| **A1 Auto within guardrails** | Runs, logged, reversible, capped | Pause underperforming ads; shift budget ±20%/day between approved ad sets inside the campaign cap; add Gatekeeper-passed creatives to approved ad sets; enrol contacts in approved sequences within volume caps; send lifecycle messages from approved templates; Lead Desk replies from approved scripts; book meetings; publish variants of approved pages |
| **A2 Human approves (one tap, batched)** | Queued in Mission Control, one daily digest | New campaign launch or budget increase; new outbound sequence/template; any post under a real person's name; new landing page; any new claim, offer or price; first send to a new list; new lifecycle flow |
| **A3 Human only** | Engine prepares, human acts | Community participation (Reddit, comments, forums) under a real identity; sales calls and proposals; creator/partner deals; billing and payments; legal or reputational responses |

**Earned autonomy.** Every A2 approval records whether the human edited it and by how much. An action class (e.g. "Meta ad launch for CCD into an approved campaign") is promoted from A2 to A1 after 20 consecutive approvals with no material edits, and demoted on any incident. Founder-voice posts and new outbound templates never auto-promote (P3).

**Hard limits no level overrides:** per-campaign daily and lifetime spend caps; account-level monthly cap; deliverability kill switch (bounce > 2%, complaint > 0.1%); no posting as fake users; no fabricated reviews, testimonials or results; platform AI-labelling rules always followed; any agent can halt its lane, only a human can restart a halted lane.

---

## 6. Data layer

**System of record: Supabase (Postgres + pgvector + Storage + Edge Functions).** One database for all brands, row-scoped by `brand_id`. Assets' binaries live in Magnific/Canva/Supabase Storage; human-readable docs (strategy, memos) mirror to Claude Docs or Google Drive.

| Table | Holds | Written by | Read by |
|---|---|---|---|
| `brands` | Profile, voice rules, ICP, brand kit refs, connected accounts | Human, Strategist | All |
| `campaigns` | Brief, playbook, budget caps, status, primary metric | Conductor | All |
| `runs`, `tasks` | Task graph, dependencies, state, cost | Conductor, agents | Conductor, Mission Control |
| `segments`, `motivations` | Motivation matrix | Strategist | Studio, Voice, Hunter |
| `concepts`, `assets` | Every creative/post/page/email with tags (motivation, concept, format, hook, voice, ai_level), gate + approval status, embedding | Production agents, Gatekeeper | Distribution, Analyst |
| `placements` | Asset ↔ platform IDs (Meta ad ID, Apollo step ID, URL) | Distribution agents | Analyst |
| `accounts`, `contacts`, `signals` | B2B targets and intent events | Hunter, Scout | Hunter, Lead Desk |
| `leads`, `touches`, `conversations` | Every lead, source, UTM, **HDYHAU raw + coded**, score, status, transcript | Pages, Lead Desk, Lifecycle | Analyst, Hunter |
| `metrics_daily` | Spend, impressions, clicks, leads, qualified, revenue per entity per day | Analyst | All |
| `experiments` | Hypothesis, variants, metric, sample, result, confidence | Strategist, Analyst | Conductor |
| `learnings` | Claim, evidence, scope (brand/vertical/global), confidence, last validated | Analyst | **Every agent, before acting** |
| `approvals` | Item, requested, decision, edit distance, approver | Gatekeeper, human | Autonomy promotion logic |
| `agent_runs` | Agent, inputs, outputs, tokens/credits, duration, errors | All | Cost control |
| `voice_corpus` | Embedded writing samples per voice | Voice | Voice, Gatekeeper |
| `citation_snapshots` | AI-answer share of voice per engine/prompt | Search | Analyst |

**Human UI: Mission Control** (Next.js on Vercel, reading Supabase): approvals inbox, campaign board, leads, metrics, learnings, cost per agent. This is the marketing lane of Param OS. Until it ships, the approvals inbox is a daily Gmail digest.

---

## 7. Runtime: how it actually runs

| Phase | How agents execute | Why |
|---|---|---|
| **Weeks 1-4** | Each agent is a skill. Scheduled tasks in this environment run them on a cadence (Analyst daily 7am, Media Buyer daily, Hunter weekdays, Voice weekly, Scout per brief). They use the connectors already authorised here. State lives in Supabase. | Zero new infra, ships in days, every connector already works. |
| **Event-driven pieces, from week 1** | Supabase Edge Function on form submit / WhatsApp webhook: write lead, send instant acknowledgement, alert Param. | Scheduled tasks run hourly at best; speed-to-lead needs seconds [05]. |
| **Month 2+** | Move Lead Desk, signal watchers and the Conductor's task dispatcher to a Claude Agent SDK service (Vercel functions + Supabase queue). Keep creative and analysis on schedules. | Real-time lanes need a server; batch lanes stay cheap. |

**Cost control (lesson from pausing Param OS):** every run logs credits to `agent_runs`; each agent has a monthly budget; the Conductor skips low-value runs when a lane is over budget; batch generation over drip calls; Analyst uses the cheapest model that passes its checks.

---

## 8. Tool map: connected today vs gaps

| Need | Connected now | Gap → recommended connector |
|---|---|---|
| Meta ads (create, manage, insights, lift tests, Ad Library) | facebook_ads | none |
| LinkedIn / Google / TikTok ads | none | Adspirer (ads ops) or Windsor.ai (reporting; already started, connection incomplete) |
| Creative generation (image, video, audio) | Magnific, Canva | none |
| SEO / GEO / AI share of voice / GSC | Ahrefs (incl. Brand Radar, GSC), Semrush | none |
| Prospecting, enrichment, sequences | Clay, Apollo | none |
| Email (1:1, digests) and calendar | Gmail, Google Calendar | none |
| Lifecycle email/SMS | none | Klaviyo (in directory) |
| WhatsApp Business API (CTWA, flows, lifecycle) | none | Interakt / AiSensy / Gupshup, direct API or via Zapier |
| Database, functions, storage | Supabase | none |
| Landing pages, Mission Control, analytics | Vercel | none |
| Glue / long-tail apps | Zapier, Airtable | none |
| Approvals and alerts in chat | Gmail digest | Slack (in directory) |
| Organic social publishing (IG, LinkedIn) | facebook_ads boosts only; Ahrefs has social post tools to verify | Verify Ahrefs social posting; else Buffer/Metricool via Zapier |
| Cross-channel reporting | per-platform | Windsor.ai (finish connecting) |

---

## 9. Feedback loops: how the system learns

1. **Daily creative loop (Analyst → Media Buyer → Studio).** Per ad: spend, CTR, cost per primary result, frequency, hook rate. Rules: pause if spend ≥ 2× target cost with zero results; scale +20% if cost ≤ 0.8× target with ≥ 10 results; flag fatigue when frequency > 3 and CTR falls 30% from peak. Every pause or win produces a brief to Studio: "new concept in motivation X, different format", never a recolour of the same ad (P1).
2. **Weekly learning loop.** Analyst codes HDYHAU, reconciles platform-reported vs Supabase-observed results, updates `learnings` (e.g. "CCD: scarcity motivation beats social-proof on cost per ticket, 3 events, confidence medium"), and the Strategist re-weights the motivation matrix. Hunter's reply sentiment and positive-reply rate by segment feed sequence rewrites.
3. **Monthly strategy loop.** Channel mix vs blended and new-customer CAC; positioning refresh from new customer language; AI-citation share check per engine; one incrementality test (Meta conversion lift via the connected lift tool, or a geo holdout).
4. **Autonomy loop.** Approval edit rates promote and demote action classes (section 5).
5. **Cross-brand priors.** New briefs start from scoped learnings; a learning is "fact" only when replicated across ≥ 2 campaigns, otherwise a prior to test.

**Statistical hygiene:** no "winner" below a minimum sample (≥ 30 primary conversions per arm, or ≥ 90% posterior probability); everything else is labelled directional. The engine optimises to the brief's primary metric, never to CTR or opens (P6).

---

## 10. Build order: results in week 1, not month 3

**Pilots.** Two brands that exercise both halves of the engine:
- **Cats Can Dance** (creator/media + events): Meta creative engine, IG distribution from the 150k page, HDYHAU at ticket checkout. Events give hard deadlines and fast feedback.
- **Iterate** (B2B service): founder-led LinkedIn, signal outbound, GEO. The engine generates Iterate's own pipeline and becomes its strongest case study and product.

SoleSearch joins in month 2 as the consumer/e-commerce test (flows, drops, back-in-stock).

### Week 1 (ship by day 7)
1. **Data spine:** Supabase project + core tables (brands, campaigns, tasks, assets, placements, leads, metrics_daily, approvals, agent_runs, learnings).
2. **Capture:** HDYHAU added to CCD ticket flow and Iterate contact form; Edge Function writes leads, sends instant acknowledgement, emails Param within a minute.
3. **Strategy run:** Scout + Strategist for both pilots → Gate 1.
4. **CCD paid sprint:** Studio produces 15-20 distinct creatives across 5 motivations for the next event; Gatekeeper passes; Media Buyer builds the Advantage+ campaign paused → approve → live. Analyst daily pull from day 2.
5. **Iterate voice:** Voice drafts 3 founder LinkedIn posts + 1 document post from Param's existing writing; he edits and posts.
6. **Outbound clock:** buy 2-3 secondary domains, set SPF/DKIM/DMARC, start warm-up (sending starts week 3; this is the one thing that cannot be rushed [04]).

**Week-1 scorecard:** CCD ads live with ≥ 15 distinct concepts; first tickets/leads carrying HDYHAU; 3 founder posts out; domains warming; daily metrics landing in Supabase.

### Week 2
Pages agent (message-matched landing pages, WhatsApp entry); Social agent for CCD; Clay signal lists and first sequence drafts for Iterate's ICP; Mission Control v0 (approvals inbox + campaign board); WhatsApp BSP and Klaviyo connected.

### Weeks 3-4
Hunter live (human-edited templates, capped volume); Lead Desk qualification scripts; learnings table + first weekly memo; Search agent baseline (AI share of voice in Ahrefs Brand Radar, 5 commercial/case-study pages for Iterate); first lifecycle flows (CCD welcome + post-event loop).

### Month 2
Conductor takes arbitrary briefs end to end; SoleSearch onboarded; first autonomy promotions; Lead Desk and signal watchers move to the Agent SDK service; LinkedIn/Google channels via connector; cost dashboard per agent.

### Month 3
First Meta conversion-lift test; cross-brand priors live; MMM only if paid spend justifies it [09]; package the engine as an Iterate offering.

---

## 11. What I'd deliberately not build

- **A fully autonomous AI SDR.** Human-edited copy wins and unedited AI email is now actively penalised by buyers [04][10].
- **Programmatic blog farms.** Informational content is losing clicks to AI answers; the Search agent writes fewer, data-backed, commercial pages [02].
- **Fake community presence.** Seeding Reddit/G2 with sock-puppet accounts is the obvious "autonomous" move and the one that gets brands banned and burned. The engine finds and drafts; real people post.
- **Multi-touch attribution software.** Self-report + platform data + periodic lift tests is cheaper and closer to the truth [09].
- **Custom ad-delivery logic.** Meta's own optimisation beats hand-built targeting; the engine's edge is creative variety and speed [03].

---

## 12. Decisions needed from you

1. **Pilots:** CCD + Iterate as proposed, or different?
2. **Spend caps:** monthly paid budget per pilot, and the daily cap the engine may never exceed.
3. **Approver:** you alone for all A2 items, or a collaborator per brand for specific lanes?
4. **WhatsApp BSP:** Interakt, AiSensy or Gupshup (any existing account wins).
5. **Lifecycle tool:** Klaviyo, or stay on Gmail/WhatsApp until volume justifies it.
6. **Connectors to add:** Windsor.ai (finish), Klaviyo, Slack, and one of Adspirer for LinkedIn/Google ads.
7. **Outbound domains:** approve buying 2-3 lookalike domains for Iterate.
