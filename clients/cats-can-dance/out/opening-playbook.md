# Opening playbook · Cats Can Dance

Fix leaks before buying traffic. These recover demand you already have, which makes them the most certain wins available. Blockers first.

## The engine can do now (5)
- [ ] **Leads acknowledged within 10 minutes** (major) · Turn on the instant acknowledgement in lead-intake (RESEND_API_KEY + MM_FROM_EMAIL) and run Lead Desk on events.
- [ ] **Welcome flow** (major) · Run `mm run lifecycle`, approve, then build it in the sending tool. → `lifecycle`
- [ ] **Pre-event reminder (cuts free-RSVP no-shows)** (major) · Run `mm run lifecycle`, approve, then build it in the sending tool. → `lifecycle`
- [ ] **Post-event 'next one' loop** (minor) · Run `mm run lifecycle`, approve, then build it in the sending tool. → `lifecycle`
- [ ] **Each ad motivation lands on a matching page** (minor) · Run `mm run pages --input '{"motivationId":"<id>",...}'` for the unmatched motivations, or send them to the closest page. → `pages`

## Needs you (5)
- [ ] **Strategy approved by a human** (blocker, blocks spend+outbound) · Review research/strategy.md and approve it.
- [ ] **Machine and caps approved** (blocker, blocks spend+outbound) · Review machine.yaml and approve it.
- [ ] **Meta ad account in client.yaml** (major) · Add accounts.meta_ad_account to client.yaml (act_<id>).
- [ ] **Hot leads alert a human** (minor) · Set MM_ALERT_WEBHOOK (Slack/Zapier/WhatsApp relay).
- [ ] **Writing samples for Param Minhas** (minor) · Paste 10-20 real posts or messages by Param Minhas into voice/param.md.

## Needs a developer (6)
- [ ] **Meta pixel sends conversion events** (blocker, blocks spend) · Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md. → `out/fixes/meta-pixel.md`
- [ ] **Every lead reaches the engine** (blocker, blocks spend+outbound) · Pull the site's conversions from supabase://jybloszaucgqlbkzquqw/marketing.leads_feed into the engine (`mm import feed`, see the Lead Desk skill). Needs the feed to exist and a human OK to read lead data. → `supabase/functions/lead-intake`
- [ ] **Server-side Conversions API** (major) · Send the same conversion event server-side from the RSVP/lead/checkout handler with event_id dedup. Notes in out/fixes/meta-pixel.md. → `out/fixes/meta-pixel.md`
- [ ] **'How did you hear about us' on every high-intent form** (major) · Add a required free-text field to RSVP, signup, booking and contact forms and pass it to the lead store. Snippet in out/fixes/hdyhau-field.html. → `out/fixes/hdyhau-field.html`
- [ ] **Known leak: WhatsApp opt-ins are collected (RSVP, crews) but nothing is ever sent:** (major) · WhatsApp opt-ins are collected (RSVP, crews) but nothing is ever sent: no WhatsApp Business provider is connected, so there are no WhatsApp reminders or recaps.
- [ ] **No unkept 'coming soon' promises on money paths** (minor) · Review the listed placeholders; most are harmless empty states.