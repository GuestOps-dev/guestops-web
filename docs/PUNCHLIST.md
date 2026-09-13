# GuestOpsHQ continuation punch list

Updated September 13, 2026. This is the working list for the next session; it separates product work that is ready to build from items that depend on an outside service or a business decision.

## End-of-day checkpoint

- [x] **Protected testing from live WhatsApp-group actions.** Starting a Lodgify booking now requires a confirmation that it creates only internal GuestOpsHQ guest/stay/Inbox records. Group screens and follow-ups explicitly say that they are internal preparation only: they do not create a WhatsApp group, invite anyone, or send a guest message.
- [x] **Unified the main workspace navigation.** Inbox, Overview, New Bookings, Experiences, Follow-ups, Vendors, and Property Guide now share a clear navigation bar designed for laptop and phone use.
- [x] **Ran the live production safety smoke check.** Public pages, dashboard protection, and protected guest-data/API routes all passed on `guestopshq.com`.

## First priorities

- [ ] **Finish each Property Guide.** All three Lodgify rental mappings and default Scott/Orlando group participants are set. Casa Cielo has approved AI guidance and a welcome draft. Add the house-specific AI guidance, welcome draft, sleeping arrangements, and notes for Casa de Vistas Infinitas and El Nido; fill the remaining Casa Cielo access/house details.
- [ ] **Verify the Lodgify reservation flow end to end.** Create or use a test reservation, confirm it arrives in New Bookings once, check all guest/stay fields, then move it deliberately into the Inbox. New bookings should create a record only; they must not send a welcome message automatically.
- [ ] **Add the real team setup.** A protected Team page now lists team access and can send an intentional invitation with an organization role and a role at one selected house. Decide who needs a login (starting with Orlando) and what each person may do. The remaining product work is assigning conversations and follow-ups to another team member; current self-assignment behavior is intentionally limited.
- [ ] **Restore live AI testing once API billing is active.** The OpenAI key is saved, but the last live request reported an exhausted credit balance. After billing is funded, test a reply draft and a conversation summary with real but non-sensitive examples. AI should remain a draft/recommendation tool until explicitly approved for any new action.
- [ ] **Confirm the supported WhatsApp group path.** Verify with Meta/Twilio whether the connected WhatsApp Business Account supports the exact group workflow needed: create/manage a group, invite members with consent, receive group events/messages, and retain the provider group ID. Do not automate a personal WhatsApp account or WhatsApp Web.

## Product improvements queued next

- [ ] **Complete the group-chat launch flow.** New Bookings captures or corrects the guest mobile number before intake; each current property now defaults to a prepared WhatsApp group including Scott and Orlando, and the Inbox shows its setup status and participant list. The remaining step is to create the provider-supported group when available. Default channel remains WhatsApp.
- [ ] **Finish the team/role experience.** Team invitations plus organization/property roles are live. Add multi-property assignment, role editing/removal, and operator-to-operator conversation/follow-up assignment after the real accounts are known.
- [ ] **Make follow-ups even more operational.** Editing, closing/reopening, and due-date filters are live. Add operator-to-operator reassignment after real staff accounts are available; consider an overdue escalation rule after live use.
- [ ] **Add AI maintenance recommendations.** The internal Maintenance workspace is live, including property/conversation links, priority, open/in-progress/resolved status, manual reporting, and recurrence counting. Once AI billing is active, have AI recommend likely issues (for example AC trouble, a damaged mirror, or a jammed lock) for human review. It must never send a guest or vendor message automatically.
- [ ] **Add recurring stay services, starting with daily housekeeping.** Configure each house’s assigned cleaner (Liz for Casa Cielo, Juli for El Nido, Jenny for Casa de Vistas Infinitas). A stay can have no service, selected service days, or daily service; record a guest-confirmed standing time (for example, daily at 10 AM) or mark the next day as awaiting a guest preference. Create an internal daily schedule and team/cleaner-only coordination draft; exclude guests and never create/send a WhatsApp group/message automatically. Support complete, skipped, and rescheduled outcomes, while keeping the guest/stay preference visible for future days.
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
- Never create, invite to, or message a real WhatsApp group during testing. Current group setup is internal-only.
- A welcome message can vary by house and should be selected from the Property Guide, not globally hard-coded.

## Already delivered

- Marketing homepage with product overview and secure information-request form sent to `info@guestopshq.com`.
- Inbox improvements: relative timestamps, cleaner guest display, reply-needed signals, color-coded status controls, and combined Inbox / Waiting on Guest / Closed views.
- Guest and stay profiles: property, check-in/check-out, preferred language, and active-stay prioritization.
- Property Guide foundations: AI guidance, welcome-message placeholders, default group participants, known contacts, sleeping arrangements, notes, and a cross-property readiness panel. Casa Cielo has its initial approved guide content.
- New Bookings workspace with property filtering and most-recent sorting, plus Lodgify-ready reservation records.
- Follow-ups workspace with manual task creation, editing, closing/reopening, and All / Overdue / Due today filters.
- Vendor workflow and Operations overview foundations, including recent messaging insights.
- Vendor coordination: an experience can prepare a private team-and-vendor-only coordination record and draft with party size, date/time, pickup details, and notes. It never includes the guest or creates a live WhatsApp group/message.
- Maintenance workspace: internal property maintenance records with priority, status, recurrence counting, and source conversation links. Automatic AI detection remains queued until AI billing is active.
- Account-wide Experiences library, with per-property availability controls, approved internal reference details for AI, and stay-level planning/follow-ups for enabled experiences.
- WhatsApp Business Account and sender work begun; provider-level group capability still needs confirmation.
- End-of-day safety safeguards: explicit booking-intake confirmation, internal-only group language, and no live group creation/invitation/message path in the app.
- A consistent primary navigation bar across the operational workspace.
- Protected Team workspace: intentional email invitations and a single-property role assignment for owner/admin-managed accounts.

## Best starting point next time

1. Run one intentionally created **test** Lodgify reservation through New Bookings. Do not use a real guest reservation until the flow is familiar.
2. Add the remaining house-specific Property Guide details for Casa de Vistas Infinitas and El Nido (and Casa Cielo access details).
3. Decide whether to invite Orlando first through **Team** as a Concierge, then confirm which houses he should access.
4. Check whether OpenAI API billing is funded, then run one controlled draft test.
5. Get a definitive Meta/Twilio answer on official WhatsApp group support before building the live group-creation step.
