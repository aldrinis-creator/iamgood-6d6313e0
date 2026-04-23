
## Plan — Fix new-guardian SOS delivery + add MSG91 Guardian Invite template

### Issue 1: Newly added guardian did not receive SOS

The most likely cause is that `send-sos-alert` only resolves recipients from guardians whose `status = 'accepted'`. A guardian you just added in My Profile is created with `status = 'pending'` until they accept the invite (or 24h auto-accept), so they are silently excluded from the SOS recipient list — which is why you got no confirmation.

I will:

1. **Confirm the cause** by reading the recently-added guardian row(s) for your user (`status`, `guardian_phone`, `nominated_at`) — read-only check, no changes.
2. **Update `supabase/functions/send-sos-alert/index.ts`** so SOS recipients include guardians with `status IN ('accepted','pending')`. Pending guardians are still real people the user explicitly nominated, and SOS is life-safety — they should be alerted. Each attempt row in `sos_message_attempts` will record the guardian's status at send-time.
3. **Surface pending guardians in `SOSDialog.tsx`** with an amber "Pending acceptance — will still be alerted" badge next to their phone, so the user knows who is being contacted and in what state.
4. **Improve the post-send confirmation** so the success/partial/failed banner lists each recipient with channel outcome (WA accepted / SMS accepted / skipped: self-targeted / skipped: invalid number). This guarantees the user always sees a clear confirmation of what happened, even when zero messages were actually delivered.
5. **Pull edge logs** after the next test SOS to verify both guardians appear in the recipient list and MSG91 returns `type: success` for each.

### Issue 2: MSG91 Guardian Invite template

Today, `send-guardian-invite` reads `MSG91_INVITE_TEMPLATE_ID` from secrets and calls MSG91 Flow API with these variables per recipient:

- `guardian_name`
- `user_name`
- `relation`
- `accept_link`
- `reject_link`

The secret already exists (`MSG91_INVITE_TEMPLATE_ID` is set), but you've asked for the **template content itself** to be created in the MSG91 dashboard. I cannot create templates inside MSG91 for you — that requires logging into your MSG91 account and (for WhatsApp) Meta approval. What I can do is:

1. **Provide ready-to-paste template copy** (WhatsApp + SMS variants) matching the exact variable names the edge function already sends, so you only need to paste, submit for approval, and copy the resulting Template ID back into the `MSG91_INVITE_TEMPLATE_ID` secret if it changes.
2. **Document the MSG91 Flow variable mapping** (`guardian_name`, `user_name`, `relation`, `accept_link`, `reject_link`) so the template variables line up 1:1 with what the backend sends — otherwise MSG91 silently drops variables.
3. **Add a small diagnostic** to `send-guardian-invite` that logs the MSG91 response body (currently it only logs "MSG91 invite sent to: …" without the response), so future invite failures are debuggable the same way SOS attempts now are.
4. **Optionally** create a `guardian_invite_attempts` audit table mirroring `sos_message_attempts` so invite delivery is also tracked and visible. I'll only build this if you want it — say the word and I'll add it. Default plan: skip it for now to keep scope tight.

### Template copy I will hand you (for MSG91 dashboard)

**WhatsApp template** (category: Utility, language: English):

> 🛡️ *Guardian Nomination — Check-iN*
>
> Hi {{1}},
>
> *{{2}}*{{3}} has nominated you as their Guardian on Check-iN, a personal emergency response app. As a Guardian you'll receive SOS alerts, check-in updates, medication adherence and fall detection notifications.
>
> ✅ Accept: {{4}}
> ❌ Reject: {{5}}
>
> You have 24 hours to reject. After that the nomination is auto-accepted.
>
> — Check-iN

Variable mapping when registering in MSG91:
`{{1}}` = `guardian_name`, `{{2}}` = `user_name`, `{{3}}` = `relation`, `{{4}}` = `accept_link`, `{{5}}` = `reject_link`

**SMS template** (transactional, DLT-registered):

> {{user_name}}{{relation}} has nominated you as their Guardian on Check-iN. Accept: {{accept_link}} Reject: {{reject_link}}. Auto-accepts in 24h. - Check-iN

### Files I will edit

- `supabase/functions/send-sos-alert/index.ts` — include `pending` guardians in recipient resolution; tag attempt rows with guardian status.
- `supabase/functions/send-guardian-invite/index.ts` — log full MSG91 response body for debuggability.
- `src/components/SOSDialog.tsx` — show recipient list with status badges and per-channel outcome in the confirmation banner.

### What I will NOT change

- No DB migration. No new tables. No webhook changes.
- No edits to MSG91 templates from my side — you must paste the copy above into your MSG91 dashboard and submit for WhatsApp approval.
- No change to the 24h auto-accept logic.

### Verification

1. Logs show both your guardians (Don Carlos + the new one) in the recipient list with status flagged.
2. SOS confirmation banner lists each guardian's name + phone + per-channel result.
3. MSG91 logs show `type: success` for each accepted recipient.
4. Once you paste and approve the WhatsApp template in MSG91 and (if needed) update `MSG91_INVITE_TEMPLATE_ID`, sending an invite to a new guardian results in a real WhatsApp message arriving on their phone, and `send-guardian-invite` logs show the MSG91 response body.
