# Readiness · cats-can-dance · 2026-11-09

**Score 34/100** · paid spend **locked** · outbound **locked** · previous 34/100

## Blocking
- Meta pixel sends conversion events: Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md.
- Every lead reaches the engine: Pull the site's conversions from supabase://jybloszaucgqlbkzquqw/marketing.leads_feed into the engine (`mm import feed`, see the Lead Desk skill). Needs the feed to exist and a human OK to read lead data.
- Strategy approved by a human: Review research/strategy.md and approve it.
- Machine and caps approved: Review machine.yaml and approve it.

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
| ? | Leads acknowledged within 10 minutes | major | No leads yet to measure. | Turn on the instant acknowledgement in lead-intake (RESEND_API_KEY + MM_FROM_EMAIL) and run Lead Desk on events. |
| ✗ | Hot leads alert a human | minor | MM_ALERT_WEBHOOK not set. | Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay). |

## lifecycle
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Welcome flow | major | No flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool. |
| ✗ | Pre-event reminder (cuts free-RSVP no-shows) | major | No flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool. |
| ✗ | Post-event 'next one' loop | minor | No flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool. |

## conversion
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✓ | Paid traffic has somewhere to convert | blocker | Site has a capture form. |  |
| ? | Each ad motivation lands on a matching page | minor | No ads yet. | Run `mm run pages --input '{"motivationId":"<id>",...}'` for the unmatched motivations, or send them to the closest page. |
| ✓ | Homepage responds fast and light | minor | 194 ms, 172 KB HTML. |  |

## promises
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ! | No unkept 'coming soon' promises on money paths | minor | src/components/EventPosterPlaceholder.tsx: "span className="opacity-60" PLACEHOLDER · POSTER COMING /span"<br>src/components/booking/DeskShell.tsx: "p className="font-display text-2xl leading-tight mb-2" Coming soon, needs database upd"<br>pages/me.tsx: "this browser. On iPhone, add the site to your Home Screen first." : "Coming soon." /span" | Review the listed placeholders; most are harmless empty states. |
| ✗ | Known leak: WhatsApp opt-ins are collected (RSVP, crews) but nothing is ever sent: | major | Listed in client.yaml audit.knownIssues. | WhatsApp opt-ins are collected (RSVP, crews) but nothing is ever sent: no WhatsApp Business provider is connected, so there are no WhatsApp reminders or recaps. |

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
| ✗ | Meta ad account in client.yaml | major | accounts.meta_ad_account not set. | Add accounts.meta_ad_account to client.yaml (act_<id>). |
| ✗ | Writing samples for Param Minhas | minor | 0 characters in voice/param.md. | Paste 10-20 real posts or messages by Param Minhas into voice/param.md. |

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