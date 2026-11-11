# Opening playbook · Iterate

Fix leaks before buying traffic. These recover demand you already have, which makes them the most certain wins available. Blockers first.

## The engine can do now (4)
- [ ] **Leads acknowledged within 10 minutes** (major) · Turn on the instant acknowledgement in lead-intake (RESEND_API_KEY + MM_FROM_EMAIL) and run Lead Desk on events.
- [ ] **Lead nurture to booked call** (major) · Run `mm run lifecycle`, approve, then build it in the sending tool, or have the site send it itself. → `lifecycle`
- [ ] **No-show recovery** (minor) · Run `mm run lifecycle`, approve, then build it in the sending tool, or have the site send it itself. → `lifecycle`
- [ ] **Each ad motivation lands on a matching page** (minor) · Run `mm run pages --input '{"motivationId":"<id>",...}'` for the unmatched motivations, or send them to the closest page. → `pages`

## Needs you (7)
- [ ] **Separate sending domains for cold email** (blocker, blocks outbound) · Buy 2-3 lookalike domains, add them to audit.sendingDomains, and warm them for 2+ weeks.
- [ ] **Strategy approved by a human** (blocker, blocks spend+outbound) · Review research/strategy.md and approve it.
- [ ] **Machine and caps approved** (blocker, blocks spend+outbound) · Review machine.yaml and approve it.
- [ ] **Mailboxes warmed 2+ weeks** (major, blocks outbound) · Warm each mailbox for 2+ weeks, then cap at 15-25 sends per mailbox per day.
- [ ] **Linkedin ad account in client.yaml** (major) · Add accounts.linkedin_ad_account to client.yaml.
- [ ] **Hot leads alert a human** (minor) · Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay).
- [ ] **Writing samples for Param Minhas** (minor) · Paste 10-20 real posts or messages by Param Minhas into voice/param.md.

## Needs a developer (11)
- [ ] **LinkedIn Insight Tag with a conversion** (blocker, blocks spend) · Add the LinkedIn Insight Tag site-wide and a conversion for the form submit in Campaign Manager.
- [ ] **Every lead reaches the engine** (blocker, blocks spend+outbound) · Deploy supabase/functions/lead-intake and set MM_LEAD_ENDPOINT, then point site forms at it, or sync the site's own lead table into the engine (`mm import feed` / `mm import lead`). → `supabase/functions/lead-intake`
- [ ] **'How did you hear about us' on every high-intent form** (major) · Add a required free-text field to RSVP, signup, booking and contact forms and pass it to the lead store. Snippet in out/fixes/hdyhau-field.html. → `out/fixes/hdyhau-field.html`
- [ ] **Meta pixel sends conversion events** (minor) · Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md. → `out/fixes/meta-pixel.md`
- [ ] **Server-side Conversions API** (minor) · Send the same conversion event server-side from the RSVP/lead/checkout handler with event_id dedup. Notes in out/fixes/meta-pixel.md. → `out/fixes/meta-pixel.md`
- [ ] **Site analytics installed** (minor) · Turn on Vercel Analytics or GA4 (or set the Plausible domain if the code already supports it).
- [ ] **WhatsApp entry or opt-in** (minor) · Add a WhatsApp opt-in to forms and a click-to-chat button on landing pages.
- [ ] **Referral with a reward for both sides** (minor) · Ask happy clients for one named intro at the moment of delivery, with a thank-you that's worth their time.
- [ ] **Share prompt right after someone buys or signs up** (minor) · On the confirmation screen and in the confirmation email, offer a one-tap share (image card plus link that carries their invite code).
- [ ] **Something of value on day one** (minor) · Give new members a small credit, a guaranteed spot or a first-order perk, tied to completing the first real action.
- [ ] **Shares and invites are counted** (minor) · Add ?ref=<id> to every share link and count shares, opens and joins against it.