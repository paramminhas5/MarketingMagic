# Readiness · cats-can-dance · 2026-11-11

**Readiness 45/100** · **Loops 38/100** · paid spend **locked** · outbound **locked** · previous 34/100

## Blocking
- Meta pixel sends conversion events: Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md.
- Every lead reaches the engine: Pull the site's conversions from supabase://jybloszaucgqlbkzquqw/marketing.leads_feed into the engine (`mm import feed`, see the Lead Desk skill). Needs the feed to exist and a human OK to read lead data.
- Strategy approved by a human: Review research/strategy.md and approve it.
- Machine and caps approved: Review machine.yaml and approve it.

## Fixed since last audit
- Pre-event reminder (cuts free-RSVP no-shows)
- Meta ad account in client.yaml

## tracking
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Meta pixel sends conversion events | blocker | No Meta pixel code found on the site or in the codebase. | Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md. |
| ✗ | Server-side Conversions API | major | No Conversions API calls found in the codebase. | Send the same conversion event server-side from the RSVP/lead/checkout handler with event_id dedup. Notes in out/fixes/meta-pixel.md. |
| ✓ | Site analytics installed | minor | Seen in: package-lock.json, package.json, src/lib/track.ts, src/components/SeoVerification.tsx… |  |

## capture
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | 'How did you hear about us' on every high-intent form | major | No 'how did you hear about us' field found on forms. | Add a required free-text field to RSVP, signup, booking and contact forms and pass it to the lead store. Snippet in out/fixes/hdyhau-field.html. |
| ✓ | Email capture on the site | major | Seen in: site, CLAUDE.md, supabase/migrations/003_product_v1.sql, supabase/migrations/033_artist_graph.sql… |  |
| ✓ | WhatsApp entry or opt-in | major | Seen in: CLAUDE.md, supabase/migrations/010_ticketing_shop_crews.sql, supabase/migrations/042_going_and_crews.sql, supabase/migrations/050_reminders.sql… |  |

## response
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Every lead reaches the engine | blocker | Lead Desk on; lead endpoint not configured; 0 leads in store. | Pull the site's conversions from supabase://jybloszaucgqlbkzquqw/marketing.leads_feed into the engine (`mm import feed`, see the Lead Desk skill). Needs the feed to exist and a human OK to read lead data. |
| · | Leads acknowledged within 10 minutes | major | Measured once leads reach the engine. | Turn on the instant acknowledgement in lead-intake (RESEND_API_KEY + MM_FROM_EMAIL) and run Lead Desk on events. |
| ✗ | Hot leads alert a human | minor | MM_ALERT_WEBHOOK not set. | Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay). |

## lifecycle
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Welcome flow | major | Not sent by the site and no flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool, or have the site send it itself. |
| ✓ | Pre-event reminder (cuts free-RSVP no-shows) | major | Sent by the site's code. Seen in: pages/api/cron/reminders.ts |  |
| ✗ | Post-event 'next one' loop | minor | Not sent by the site and no flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool, or have the site send it itself. |

## conversion
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✓ | Paid traffic has somewhere to convert | blocker | Site has a capture form. |  |
| · | Each ad motivation lands on a matching page | minor | No ads yet. Gatekeeper checks each ad's landing page before it can run. | Run `mm run pages --input '{"motivationId":"<id>",...}'` for the unmatched motivations, or send them to the closest page. |
| ✓ | Homepage responds fast and light | minor | 389 ms, 177 KB HTML. |  |

## promises
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ! | No unkept 'coming soon' promises on money paths | minor | src/components/EventPosterPlaceholder.tsx: "span className="opacity-60" PLACEHOLDER · POSTER COMING /span"<br>src/components/booking/DeskShell.tsx: "p className="font-display text-2xl leading-tight mb-2" Coming soon, needs database upd"<br>pages/me.tsx: "this browser. On iPhone, add the site to your Home Screen first." : "Coming soon." /span" | Review the listed placeholders; most are harmless empty states. |
| ✗ | Known leak: WhatsApp opt-ins are collected (RSVP, crews) but nothing is sent on Wh | major | Listed in client.yaml audit.knownIssues. | WhatsApp opt-ins are collected (RSVP, crews) but nothing is sent on WhatsApp, while the RSVP form promised a day-of reminder. Either send them or stop promising them. |

## discoverability
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✓ | llms.txt published | minor | Live at /llms.txt. |  |
| ✓ | Structured data (JSON-LD) | minor | Seen in: site, src/components/Breadcrumbs.tsx, src/components/SEO.tsx, pages/_document.tsx… |  |
| ✓ | robots.txt and sitemap | minor | robots.txt found; sitemap found. |  |

## strategy
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Strategy approved by a human | blocker | Strategy waiting in `mm approvals`. | Review research/strategy.md and approve it. |
| ✗ | Machine and caps approved | blocker | machine.yaml waiting in `mm approvals`. | Review machine.yaml and approve it. |
| ✓ | Daily spend cap set | blocker | Daily cap 700 INR. |  |
| ✓ | Meta ad account in client.yaml | major | meta_ad_account: act_1516844853853152. |  |
| ✗ | Writing samples for Param Minhas | minor | 0 characters in voice/param.md. | Paste 10-20 real posts or messages by Param Minhas into voice/param.md. |

## loops
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Referral with a reward for both sides | major | No referral or invite code found. | Give every customer a personal invite link; reward both sides once the friend actually buys or shows up, not on signup. |
| ✓ | Share prompt right after someone buys or signs up | major | Seen in: src/components/tickets/NightTools.tsx |  |
| ✗ | Loyalty that rewards coming back | major | No points, tiers or rewards found. | Points from verified purchases or visits, a clear next reward, and status tiers. Derive points from records you already trust so they can't be gamed. |
| ✗ | Something of value on day one | minor | No welcome credit or first-purchase offer found. | Give new members a small credit, a guaranteed spot or a first-order perk, tied to completing the first real action. |
| ✓ | Shares and invites are counted | minor | Seen in: supabase/migrations/048_loops.sql, src/lib/share.ts |  |

## Evidence sources
- live: https://catscandance.com
- live: https://catscandance.com/nights
- live: https://catscandance.com/whats-on
- live: https://catscandance.com/artists
- live: https://catscandance.com/promote
- live: https://catscandance.com/gate
- codebase: /home/claude/catscandanceoct2026 (682 files)
- engine state

## Fix kit written
- out/fixes/hdyhau-field.html
- out/fixes/meta-pixel.md

_Something the Auditor can't see but you've confirmed? Add it under `audit.attest` in client.yaml, e.g. `deliverability.warmup: "warmed since Nov 1"`._