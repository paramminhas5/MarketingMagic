# Connections · Cats Can Dance · 2026-11-09

2 connected · 6 to do · 4 optional

## To do
- [ ] **Alerts** (Param): Hot leads and digests have nowhere to go, so a hot lead can sit for hours. Make a Slack or Discord incoming webhook and set MM_ALERT_WEBHOOK.
- [ ] **Paid** (Param): No Meta ad account, so campaigns can't be built (paused) or read. Add accounts.meta_ad_account: act_<id> (Ads Manager, top left).
- [ ] **Voice** (Param): Param Minhas: 0 characters of samples. Drafts won't sound like them yet. Paste 10 to 20 real posts or messages into clients/cats-can-dance/voice/param.md.
- [ ] **Confirm** (Param): Leads acknowledged within 10 minutes: the engine can't see this. Check it, then add `response.speed: "<what you saw>"` under audit.attest in client.yaml.
- [ ] **Confirm** (Param): Each ad motivation lands on a matching page: the engine can't see this. Check it, then add `conversion.message_match: "<what you saw>"` under audit.attest in client.yaml.
- [ ] **Approvals** (Param): 3 assets waiting for you. mm approvals --client cats-can-dance

## Everything
| | area | state | how |
|---|---|---|---|
| · | Model | No API key. Thinking steps wait as pending files for a Claude session (the daily scheduled task answers them). | Optional: set ANTHROPIC_API_KEY to run unattended without a session. |
| · | Store | File store in this repo. Fine for one machine. | To share state across sessions: connect a Supabase project, set MM_STORE=supabase, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and apply supabase/migrations. |
| ✓ | Leads | Leads feed: supabase://jybloszaucgqlbkzquqw/marketing.leads_feed. Lead Desk pulls it with the Supabase connector. |  |
| · | Leads | Reading the leads feed needs your OK once: it holds names and emails. | Say "OK to import leads" in a session, or keep importing by hand with mm import feed. |
| ✗ | Alerts | Hot leads and digests have nowhere to go, so a hot lead can sit for hours. | Make a Slack or Discord incoming webhook and set MM_ALERT_WEBHOOK. |
| ✓ | Site code | Codebase at /home/claude/catscandanceoct2026. The Auditor reads it and counts only what's on the default branch as live. |  |
| ✗ | Paid | No Meta ad account, so campaigns can't be built (paused) or read. | Add accounts.meta_ad_account: act_<id> (Ads Manager, top left). |
| · | Paid | No Meta token: the Meta connector in a Claude session does the work instead. | Optional: a system-user token in META_ACCESS_TOKEN for unattended metric pulls. |
| ✗ | Voice | Param Minhas: 0 characters of samples. Drafts won't sound like them yet. | Paste 10 to 20 real posts or messages into clients/cats-can-dance/voice/param.md. |
| ✗ | Confirm | Leads acknowledged within 10 minutes: the engine can't see this. | Check it, then add `response.speed: "<what you saw>"` under audit.attest in client.yaml. |
| ✗ | Confirm | Each ad motivation lands on a matching page: the engine can't see this. | Check it, then add `conversion.message_match: "<what you saw>"` under audit.attest in client.yaml. |
| ✗ | Approvals | 3 assets waiting for you. | mm approvals --client cats-can-dance |