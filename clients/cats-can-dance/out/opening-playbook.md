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

## Needs a developer (9)
- [ ] **Meta pixel sends conversion events** (blocker, blocks spend) · Install the Meta pixel with the real conversion event (RSVP / Lead / Purchase) and verify it in Events Manager. Snippet in out/fixes/meta-pixel.md. → `out/fixes/meta-pixel.md`
- [ ] **Every lead reaches the engine** (blocker, blocks spend+outbound) · Deploy supabase/functions/lead-intake and set MM_LEAD_ENDPOINT, then point site forms at it, or sync the site's own RSVP/lead table into the engine (`mm import lead`). → `supabase/functions/lead-intake`
- [ ] **Server-side Conversions API** (major) · Send the same conversion event server-side from the RSVP/lead/checkout handler with event_id dedup. Notes in out/fixes/meta-pixel.md. → `out/fixes/meta-pixel.md`
- [ ] **'How did you hear about us' on every high-intent form** (major) · Add a required free-text field to RSVP, signup, booking and contact forms and pass it to the lead store. Snippet in out/fixes/hdyhau-field.html. → `out/fixes/hdyhau-field.html`
- [ ] **No unkept 'coming soon' promises on money paths** (major) · Ship the promised feature or remove the promise from the UI before sending traffic.
- [ ] **Known leak: Points redemption: users earn CCD points but the dashboard says 'redem** (major) · Points redemption: users earn CCD points but the dashboard says 'redemption launching soon' (README calls it a broken promise). Ship a shop discount at 100 points.
- [ ] **Known leak: Curated events link offsite: add /events/curated/:id pages with MusicE** (major) · Curated events link offsite: add /events/curated/:id pages with MusicEvent JSON-LD so CCD owns the page, the SEO and the RSVP.
- [ ] **Known leak: No 24h pre-event WhatsApp reminder for RSVPs who opted in (phone field** (major) · No 24h pre-event WhatsApp reminder for RSVPs who opted in (phone field already collected).
- [ ] **Known leak: No attended/check-in flow: post-event pages are dead ends; add 'were y** (major) · No attended/check-in flow: post-event pages are dead ends; add 'were you there' + XP.