# Readiness · iterate · 2026-11-09

**Readiness 28/100** · **Loops 20/100** · paid spend **locked** · outbound **locked** · previous 28/100

## Blocking
- LinkedIn Insight Tag with a conversion: Add the LinkedIn Insight Tag site-wide and a conversion for the form submit in Campaign Manager.
- Every lead reaches the engine: Deploy supabase/functions/lead-intake and set MM_LEAD_ENDPOINT, then point site forms at it, or sync the site's own lead table into the engine (`mm import feed` / `mm import lead`).
- Strategy approved by a human: Review research/strategy.md and approve it.
- Machine and caps approved: Review machine.yaml and approve it.
- Separate sending domains for cold email: Buy 2-3 lookalike domains, add them to audit.sendingDomains, and warm them for 2+ weeks.

## tracking
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Meta pixel sends conversion events | minor | No Meta pixel code found on the site or in the codebase. | Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md. |
| ✗ | LinkedIn Insight Tag with a conversion | blocker | No LinkedIn Insight code found on the site or in the codebase. | Add the LinkedIn Insight Tag site-wide and a conversion for the form submit in Campaign Manager. |
| ✗ | Server-side Conversions API | minor | No Conversions API calls found in the codebase. | Send the same conversion event server-side from the RSVP/lead/checkout handler with event_id dedup. Notes in out/fixes/meta-pixel.md. |
| ✗ | Site analytics installed | minor | No analytics script found. | Turn on Vercel Analytics or GA4 (or set the Plausible domain if the code already supports it). |

## capture
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | 'How did you hear about us' on every high-intent form | major | No 'how did you hear about us' field found on forms. | Add a required free-text field to RSVP, signup, booking and contact forms and pass it to the lead store. Snippet in out/fixes/hdyhau-field.html. |
| ✓ | Email capture on the site | major | Seen in: site, app/contact/ContactContent.tsx, app/careers/CareersContent.tsx |  |
| ✗ | WhatsApp entry or opt-in | minor | No WhatsApp entry point or opt-in found. | Add a WhatsApp opt-in to forms and a click-to-chat button on landing pages. |

## response
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Every lead reaches the engine | blocker | Lead Desk on; lead endpoint not configured; 0 leads in store. | Deploy supabase/functions/lead-intake and set MM_LEAD_ENDPOINT, then point site forms at it, or sync the site's own lead table into the engine (`mm import feed` / `mm import lead`). |
| ? | Leads acknowledged within 10 minutes | major | No leads yet to measure. | Turn on the instant acknowledgement in lead-intake (RESEND_API_KEY + MM_FROM_EMAIL) and run Lead Desk on events. |
| ✗ | Hot leads alert a human | minor | MM_ALERT_WEBHOOK not set. | Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay). |

## lifecycle
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Lead nurture to booked call | major | No flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool. |
| ✗ | No-show recovery | minor | No flow drafted. | Run `mm run lifecycle`, approve, then build it in the sending tool. |

## conversion
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✓ | Paid traffic has somewhere to convert | blocker | Site has a capture form. |  |
| ? | Each ad motivation lands on a matching page | minor | No ads yet. | Run `mm run pages --input '{"motivationId":"<id>",...}'` for the unmatched motivations, or send them to the closest page. |
| ✓ | Homepage responds fast and light | minor | 821 ms, 60 KB HTML. |  |

## promises
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✓ | No unkept 'coming soon' promises on money paths | minor | None found. |  |

## discoverability
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✓ | llms.txt published | minor | Live at /llms.txt. |  |
| ✓ | Structured data (JSON-LD) | minor | Seen in: site, components/site/BreadcrumbSchema.tsx, app/layout.tsx, app/services/page.tsx… |  |
| ✓ | robots.txt and sitemap | minor | robots.txt found; sitemap found. |  |

## deliverability
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Separate sending domains for cold email | blocker | No sending domains in client.yaml audit.sendingDomains. | Buy 2-3 lookalike domains, add them to audit.sendingDomains, and warm them for 2+ weeks. |
| ? | Mailboxes warmed 2+ weeks | major | The engine can't see warm-up state; attest it in client.yaml audit.attest. | Warm each mailbox for 2+ weeks, then cap at 15-25 sends per mailbox per day. |

## strategy
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Strategy approved by a human | blocker | Strategy waiting in `mm approvals`. | Review research/strategy.md and approve it. |
| ✗ | Machine and caps approved | blocker | machine.yaml waiting in `mm approvals`. | Review machine.yaml and approve it. |
| ✓ | Daily spend cap set | blocker | Daily cap 1500 INR. |  |
| ✗ | Linkedin ad account in client.yaml | major | accounts.linkedin_ad_account not set. | Add accounts.linkedin_ad_account to client.yaml. |
| ✗ | Writing samples for Param Minhas | minor | 0 characters in voice/param.md. | Paste 10-20 real posts or messages by Param Minhas into voice/param.md. |

## loops
| | check | severity | evidence | fix |
|---|---|---|---|---|
| ✗ | Referral with a reward for both sides | minor | No referral or invite code found. | Ask happy clients for one named intro at the moment of delivery, with a thank-you that's worth their time. |
| ✗ | Share prompt right after someone buys or signs up | minor | No share flow found. | On the confirmation screen and in the confirmation email, offer a one-tap share (image card plus link that carries their invite code). |
| ✓ | Loyalty that rewards coming back | minor | Seen in: app/industries/[slug]/page.tsx |  |
| ✗ | Something of value on day one | minor | No welcome credit or first-purchase offer found. | Give new members a small credit, a guaranteed spot or a first-order perk, tied to completing the first real action. |
| ✗ | Shares and invites are counted | minor | Share links don't carry a ref, so the loop can't be measured. | Add ?ref=<id> to every share link and count shares, opens and joins against it. |

## Evidence sources
- live: https://hyperiterate.com
- live: https://hyperiterate.com/contact
- codebase: /home/claude/paramminhas5/iterateblack-next (66 files)
- engine state

## Fix kit written
- out/fixes/hdyhau-field.html
- out/fixes/meta-pixel.md

_Something the Auditor can't see but you've confirmed? Add it under `audit.attest` in client.yaml, e.g. `deliverability.warmup: "warmed since Nov 1"`._