

```markdown
# REPO CANONICAL LAYOUT (DO NOT GUESS PATHS)

API routes live under:
app/api

Shared libraries live under:
src/lib

This repo does NOT use:
src/app/api

Always confirm paths using:
docs/STRUCTURE.md

before suggesting edits.

---

# CURRENT VERIFIED STATE

Next.js version: 16.1.6  
Supabase JS version: ^2.97.0  

Production build: SUCCESS  
Vercel deploy: SUCCESS  

RLS recursion: RESOLVED  

Inbox UI: WORKING  
Outbound messaging: WORKING  
Quick Replies: WORKING  
Internal Notes: WORKING  
Conversation Claim/Assign: WORKING  
Guest linking trigger: WORKING  

Next.js 16 route handlers require:

```

context: { params: Promise<{ id: string }> }

```

---

# CURRENT SYSTEM CAPABILITIES

## Messaging System

### Inbound

Twilio webhook ingestion working  
Conversations created correctly  
Property routing working  

### Outbound

Route:
app/api/messages/send/route.ts

Characteristics:

- Uses requireApiAuth
- Uses Supabase service role for DB writes
- Twilio send confirmed working
- Idempotency supported

### Mark Read

Route:
app/api/conversations/[id]/read/route.ts

Characteristics:

- Uses admin client for write
- No status validation (correct behavior)

### Conversations List

Route:
app/api/conversations/route.ts

Characteristics:

- RLS-bound
- Property filtering working
- Workspace dropdown working

---

# GUEST PROFILE SYSTEM (NEW)

Guest CRM groundwork has been implemented.

## Tables

guests  
guest_properties  
guest_notes  

## Conversation Link

```

conversations.guest_id → guests.id

```

This allows every conversation to be tied to a persistent guest profile.

---

## Auto-Link Trigger

Database trigger ensures guests are automatically created and linked.

Function:

```

public.ensure_conversation_guest_link()

```

Trigger:

BEFORE INSERT OR UPDATE  
ON public.conversations

Logic:

- If guest_id already exists → do nothing
- Otherwise find guest by:
  - property_id
  - phone == guest_number
- If guest does not exist → create guest
- Link conversation to guest
- Maintain guest_properties row
- Update last_seen_at

Guest records created automatically use placeholder name:

```

Guest ####

````

(where #### = last digits of phone)

These can be edited later in UI.

---

## Backfill Command Used

```sql
update public.conversations
set updated_at = now()
where guest_id is null;
````

## Confirmation Query

```sql
select count(*) total,
       count(guest_id) linked
from public.conversations;
```

Current state during this session:

Total conversations: 2
Linked to guests: 2

---

# QUICK REPLIES SYSTEM (NEW)

Quick reply templates are supported.

Table:

quick_replies

Capabilities:

* Property-scoped templates
* Insert into message composer
* Used for common guest responses

Seeded examples include:

* Welcome message
* Concierge intro
* Checkout reminder
* Thanks / follow-up

Quick replies are visible in the conversation composer UI.

---

# INTERNAL NOTES SYSTEM (NEW)

Internal notes are supported in conversation threads.

Characteristics:

* Stored separately from guest-visible messages
* Visible only to staff
* Display inline in timeline
* Timestamped
* Author recorded

This enables staff collaboration without messaging the guest.

---

# CONVERSATION ASSIGNMENT

"Claim / Assign" functionality is operational.

Route:

POST /api/conversations/[id]/assign

Behavior:

* Assigns current user to conversation
* Displays assigned staff name in UI
* Uses profiles lookup for display name

Previous failure mode:

permission denied for table conversations

Resolved via RLS policy correction.

---

# RLS MODEL (STABLE)

Access control is driven by:

property_users

Key principles:

* Profiles no longer recursive
* No infinite recursion policies
* Service role used only in controlled server routes
* User-facing routes remain RLS-bound

---

# STARTING A NEW CHAT PROTOCOL

When opening a new ChatGPT thread:

1. Paste docs/NEW_CHAT_PROMPT.txt
2. Provide the handoff URL
3. Confirm repo layout from docs/STRUCTURE.md
4. Confirm API routes from docs/CODE_INDEX.md
5. Paste the latest Cursor log if relevant
6. Then describe the issue or next feature

Rules:

Never invent file paths.

Always verify against:

docs/STRUCTURE.md
docs/CODE_INDEX.md

---

# SESSION SNAPSHOT — March 4, 2026

## Build Status

Production build: SUCCESS
Vercel deploy: SUCCESS

No TypeScript errors
No RLS recursion errors

Next.js 16 route handler signatures fixed.

---

## System Status

Messaging platform operational with:

* inbound SMS
* outbound messaging
* conversation inbox
* message timeline
* internal notes
* quick replies
* staff assignment
* guest profile linkage

System stable and ready for next development milestone.

---

# NEXT DEVELOPMENT AREAS

Potential next work items:

* Guest Profile UI panel in conversation view
* Guest CRM page (/dashboard/guests)
* Guest tags
* Guest stay history
* AI-assisted replies (ChatGPT integration)
* Property automation rules
* Vendor / concierge integrations
* Reporting dashboards

---

# GuestOpsHQ Handoff System

This repo contains a stable handoff system so new ChatGPT chats do not lose context.

## Canonical Handoff URL

The protected handoff page is:

```
/ops/handoff?k=HANDOFF_VIEW_KEY
```

It renders the latest versions of:

docs/PRODUCT_BRIEF.md
docs/PRODUCT_VISION.md
docs/TECH_HANDOFF.md
docs/M1_SMOKE_TESTS.md
docs/STRUCTURE.md
docs/CODE_INDEX.md
HANDOFF_PACK.txt

---

## How to Update / Regenerate

Run these scripts locally from repo root.

Generate folder structure:

```
.\scripts\gen-structure.ps1
```

Outputs:

docs/STRUCTURE.md

Generate code index snapshot:

```
.\scripts\gen-code-index.ps1
```

Outputs:

docs/CODE_INDEX.md

---

## Required Commit Flow

After generating:

```
git add .
git commit -m "Update handoff"
git push
```

---

## Security Notes

HANDOFF_VIEW_KEY must be set in Vercel environment variables.

Do not expose the key publicly.

Do not store secrets inside docs files.

---

# SYSTEM SUMMARY

This repo now includes:

* messaging engine
* guest system
* quick replies
* assignment
* internal notes
* RLS architecture
* canonical repo layout
* handoff documentation system

System is stable and ready for the next development phase.

```
