# GuestOpsHQ continuation punch list

Updated September 12, 2026. This is the working list for the next session; it separates product work that is ready to build from items that depend on an outside service or a business decision.

## First priorities

- [ ] **Finish each Property Guide.** Add the approved house-specific AI guidance, a welcome-message draft, Lodgify rental mapping, sleeping arrangements and notes, and the default group participants for every active property.
- [ ] **Verify the Lodgify reservation flow end to end.** Create or use a test reservation, confirm it arrives in New Bookings once, check all guest/stay fields, then move it deliberately into the Inbox. New bookings should create a record only; they must not send a welcome message automatically.
- [ ] **Add the real team setup.** Decide who needs a login and what each person may do (owner, concierge, operations, viewer). Then add property-level access and a safe way to assign conversations and follow-ups to another team member. The current self-assignment behavior is intentionally limited.
- [ ] **Restore live AI testing once API billing is active.** The OpenAI key is saved, but the last live request reported an exhausted credit balance. After billing is funded, test a reply draft and a conversation summary with real but non-sensitive examples. AI should remain a draft/recommendation tool until explicitly approved for any new action.
- [ ] **Confirm the supported WhatsApp group path.** Verify with Meta/Twilio whether the connected WhatsApp Business Account supports the exact group workflow needed: create/manage a group, invite members with consent, receive group events/messages, and retain the provider group ID. Do not automate a personal WhatsApp account or WhatsApp Web.

## Product improvements queued next

- [ ] **Complete the group-chat launch flow.** New Bookings captures or corrects the guest mobile number before intake; each current property now defaults to a prepared WhatsApp group including Scott and Orlando, and the Inbox shows its setup status and participant list. The remaining step is to create the provider-supported group when available. Default channel remains WhatsApp.
- [ ] **Build the team/role experience.** Add staff management, property assignments, and an operator-to-operator conversation/follow-up assignment control after the real accounts are known.
- [ ] **Make follow-ups even more operational.** Consider editing, reassigning, closing/reopening, and optionally escalating overdue tasks. Manual follow-ups and due-date filters already exist.
- [ ] **Decide the assistant’s chat name and personality.** GuestOpsHQ is the product; the conversational assistant still needs its final, guest-facing name.
- [ ] **Continue dashboard usability testing.** Test laptop and phone with live conversations; refine density, filters, follow-up visibility, and empty states based on real concierge use.
- [ ] **Add reporting once enough real activity exists.** Useful next measures include first-response time, open follow-ups, repeat request types, vendor/service completion, and stay/guest satisfaction. Define the source and meaning of each metric before treating it as a score.

## External checks to keep visible

- [ ] Confirm production Twilio SMS behavior and A2P campaign/number association after real traffic begins.
- [ ] Confirm WhatsApp sender status, template/24-hour messaging rules, and inbound webhook delivery in Twilio.
- [ ] Confirm Lodgify API/webhook credentials and rental-property mapping remain valid in production.
- [ ] Add a lightweight production monitoring and backup/recovery checklist once usage becomes regular.

## Operating rules already agreed

- Never send a guest message or take a guest-facing action automatically without the intended approval/guardrail.
- Never disclose personal information about Scott, Orlando, or other known contacts.
- Treat known contacts as staff/vendors in the AI context so the assistant does not contradict or impersonate them.
- Use only the official, provider-supported WhatsApp integration for any group workflow.
- A welcome message can vary by house and should be selected from the Property Guide, not globally hard-coded.

## Already delivered

- Marketing homepage with product overview and secure information-request form sent to `info@guestopshq.com`.
- Inbox improvements: relative timestamps, cleaner guest display, reply-needed signals, color-coded status controls, and combined Inbox / Waiting on Guest / Closed views.
- Guest and stay profiles: property, check-in/check-out, preferred language, and active-stay prioritization.
- Property Guide foundations: AI guidance, welcome-message placeholders, default group participants, known contacts, sleeping arrangements, and notes.
- New Bookings workspace with property filtering and most-recent sorting, plus Lodgify-ready reservation records.
- Follow-ups workspace with manual task creation and All / Overdue / Due today filters.
- Vendor workflow and Operations overview foundations, including recent messaging insights.
- Account-wide Experiences library, with per-property availability controls, approved internal reference details for AI, and stay-level planning/follow-ups for enabled experiences.
- WhatsApp Business Account and sender work begun; provider-level group capability still needs confirmation.

## Best starting point next time

1. Check whether OpenAI API billing is funded, then run one controlled draft test.
2. Confirm the list of real staff accounts and intended roles.
3. Run one Lodgify test reservation through New Bookings.
4. Get a definitive Meta/Twilio answer on official WhatsApp group support before building the live group-creation step.
