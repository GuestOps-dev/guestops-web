# GuestOpsHQ — Next Development Roadmap

---

## Current MVP status

The core messaging operator workflow is in place: authenticated inbox access,
assignment and tag filters, conversation statuses, guest profile editing, guest
tags and notes, quick replies, and safe outbound-message retry handling. The
next work should protect that reliability while making the dashboard faster and
easier to operate.

---

# Dashboard Usability Pass (MVP Enhancement)

Goal: Reduce the time and attention needed to work an active inbox.

- Completed foundation: inbox search, status/assignment/tag filters, a clear
  filters action, keyboard focus for search, responsive small-screen layout,
  self-assignment, and visible action failures with retry.
- Next: make urgency, unread activity, assignment, and conversation state even
  easier to scan from the inbox.
- Keep frequent actions—assigning, changing status, applying a quick reply,
  and adding a private note—easy to find and confirm.
- Continue refining empty, loading, and error states so operators know what
  happened and what to do next.
- Continue testing small-screen and keyboard usability without sacrificing the
  desktop workflow.
- Consider a compact at-a-glance dashboard summary only after the working
  inbox remains the fastest route to an active guest conversation.
- Validate the flow with realistic operator smoke checks before adding larger
  features such as automation or reporting.

This is intentionally scheduled after the current reliability and authorization
hardening work; it does not require a database schema change.

---

# Phase 1 — Finish the Messaging CRM (Immediate Next)

Goal: Make the inbox feel like Intercom / Front for vacation rentals.

---

## 1. Guest Profile Panel (Highest Priority)

Location: Right side of conversation view.

Displays:

- Guest Name
- Phone
- Email
- Tags
- Internal Notes
- Past Stays
- Past Conversations

### Active-stay attention

Show the property (house) name and the current booking's check-in and
check-out dates in the profile. While the current date falls within that
stay, label the conversation **In-house** and keep it prominent in the
inbox. This is derived from the booking dates, so it ends automatically at
checkout and does not overwrite a manually selected VIP or urgent priority.

Stay dates belong to a booking rather than the guest, since a returning guest
can have different dates on a later visit.

This connects messaging to the Guest CRM.

Example layout:

Guest Profile  
-------------  
John Smith  
+1 267 555 1212  

Tags  
VIP • Late Checkout  

Notes  
"Likes upstairs bedroom"

Past Conversations  
Jan 2026  
Mar 2026  

This will be the next major UX improvement.

---

## 2. Guest Tags

Add structured tags such as:

- VIP
- Repeat Guest
- High Maintenance
- Late Checkout
- Travel Agent
- Influencer

Uses:

- Inbox filtering
- Future automation
- Analytics

Database tables already exist. Only UI needs to be built.

---

## 3. Conversation Status

Currently conversations are effectively just "open".

Add status states:

- Open
- Waiting on Guest
- Waiting on Staff
- Resolved
- Closed

This enables real operational workflows.

---

## 4. Conversation Filters

Inbox filters to add:

- Unassigned
- Assigned to Me
- Open
- Waiting on Guest
- Resolved
- VIP Guests

These become essential once message volume increases.

---

# Phase 2 — Automation Engine

Goal: Reduce manual work.

---

## 5. Auto Responses

Example automation rules:

IF message contains "wifi"  
THEN send quick reply "wifi instructions"

IF message arrives after 10 PM  
THEN auto reply with emergency instructions

IF check-in day  
THEN auto send welcome message

Most of the infrastructure for this already exists.

---

## 6. AI Suggested Replies (ChatGPT)

AI suggests responses but does not auto-send.

Example UI:

Suggested Reply  
---------------  
Hi John — the wifi password is on the fridge.

[Insert] [Edit]

Purpose:

- Dramatically speeds concierge response time
- Keeps staff responses consistent

---

## 7. AI Conversation Summary

Each conversation shows a short summary.

Example:

Guest is arriving tomorrow.  
Requested private chef and airport transfer.

Useful when switching staff between shifts.

---

# Phase 3 — Property Operations Layer

Goal: Turn this into STR operations software, not just messaging.

---

## 8. Task System

Example workflow:

Guest requested towels  
→ Create Task  

Assigned to: Housekeeping  
Due: Today

Tasks can be tied to:

- Property
- Guest
- Stay

---

## 9. Vendor Contacts

Store contacts for operational vendors:

- Chef
- Driver
- Tour operator
- Maintenance
- Housekeeping

Eventually allow messaging directly to vendors.

### Current foundation

The property-scoped vendor directory is live at `/dashboard/vendors`. Teams can
add, edit, prioritize, and deactivate trusted providers without exposing them
outside their assigned property. The live database already includes the later
`experiences`, `vendor_requests`, and `reminders` tables; their first use needs
real service-type and vendor data rather than another schema migration.

---

## 10. Stay / Reservation Records

Connect:

- Guest
- Property
- Check-in
- Check-out
- Group size
- Source (Airbnb / direct)

Messaging then links directly to real reservations.

---

# Phase 4 — Owner Intelligence

Goal: Provide insights to property owners.

---

## 11. Reporting Dashboard

Potential metrics:

- Messages per stay
- Response time
- Guest satisfaction
- Common issues

---

## 12. Knowledge Base

Examples:

- WiFi instructions
- Parking instructions
- Check-in instructions
- Local recommendations

Used by:

- Staff
- AI replies
- Automation engine

---

# Phase 5 — Platform Expansion (Later)

This is where GuestOpsHQ becomes a SaaS platform.

---

## 13. Multi-Property Accounts

Allow owners to manage multiple villas.

---

## 14. Team Roles

Role examples:

- Owner
- Operations
- Concierge
- Housekeeping
- Vendor

---

## 15. WhatsApp Integration

Critical for Costa Rica guest communication.

### Shared guest concierge groups (future, high-value)

GuestOpsHQ should support a booking-specific WhatsApp group that includes the
guest party, Orlando, the owner/operations lead, and the GuestOpsHQ business
identity. The product goal is a shared, auditable concierge conversation:

- Guests can use the familiar group chat instead of learning a new portal.
- Orlando and the owner see the entire conversation in real time and can reply
  naturally whenever human judgment is needed.
- GuestOpsHQ can draft, send permitted operational messages, create follow-ups,
  surface property/stay context, and record a complete activity history.

This must use Meta's supported WhatsApp Business group capability—not an
unofficial WhatsApp Web automation or a personal-number workaround. Before
building it, confirm the business account's group eligibility, supported group
size, invite/consent flow, webhook events, and any restrictions on existing
groups. The data model must keep a stable provider group ID, member identities,
per-message sender identity, group membership events, and a human/automation
audit trail. It should remain channel-agnostic so the existing SMS thread is a
safe fallback when a group cannot be used.

---

## 16. OTA Integration

Eventually support:

- Airbnb
- VRBO
- Booking.com
- Lodgify
- OwnerRez

Do not prioritize this early.

---

# Recommended Development Order

Build in this order:

1. Guest Profile Panel  
2. Guest Tags  
3. Conversation Status  
4. Inbox Filters  
5. AI Suggested Replies  
6. Automation Rules  
7. Task System  
8. Reservation Records  
9. Vendor Contacts  
10. Reporting Dashboard
