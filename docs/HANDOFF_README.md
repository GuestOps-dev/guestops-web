# ⚠️ REPO CANONICAL LAYOUT (DO NOT GUESS PATHS)

- API routes live under: app/api
- Shared libraries live under: src/lib
- This repo does NOT use src/app/api
- Always confirm paths using docs/STRUCTURE.md before suggesting edits.

---

# 🧱 CURRENT VERIFIED STATE

- Next.js version: 16.1.6
- Supabase JS version: ^2.97.0
- Production build: SUCCESS
- RLS recursion: RESOLVED
- Outbound messaging: Uses service role for writes
- Read routes: RLS-bound
- Next 16 route handlers require: context: { params: Promise<{ id: string }> }

---

# 🎯 CURRENT FOCUS

- Messaging outbound route stable
- Mark-read route stable
- RLS enforced correctly
- Inbox working
- No known compile errors

---

# 🚀 STARTING A NEW CHAT PROTOCOL

When opening a new ChatGPT thread:

1. Paste docs/NEW_CHAT_PROMPT.txt
2. Confirm repo layout from docs/STRUCTURE.md
3. Confirm API routes from docs/CODE_INDEX.md
4. THEN describe the issue

Never invent file paths.


# 📅 SESSION SNAPSHOT — March 3, 2026

## Build Status
- Production build: SUCCESS
- Vercel deploy: SUCCESS
- No TypeScript errors
- No RLS recursion errors
- Next.js 16 route handler signatures fixed

## Messaging Architecture (Current State)

Outbound:
- Route: app/api/messages/send/route.ts
- Uses requireApiAuth for access check
- Uses Supabase service role for DB writes
- Twilio send confirmed working
- Idempotency supported

Mark Read:
- Route: app/api/conversations/[id]/read/route.ts
- Next 16 params pattern: context: { params: Promise<{ id: string }> }
- Uses admin client for write
- No status validation here (correct)

Conversations List:
- Route: app/api/conversations/route.ts
- RLS-bound
- Property filtering working
- Dropdown working

## RLS Model (Stable)

- property_users drives access
- profiles no longer recursive
- No infinite recursion policies remain
- Service role only used in controlled server routes

## Repo Layout Confirmed

- API routes: app/api
- Shared libs: src/lib
- Generator script: scripts/gen-handoff-index.mjs
- Handoff page: app/ops/handoff/page.tsx

## Known Open Items
- None blocking
- System stable
- Ready for feature work




\# GuestOpsHQ Handoff System (How this works)



This repo contains a stable “handoff system” so new ChatGPT chats don’t lose context.



\## Canonical Handoff URL

The protected handoff page is:

\- /ops/handoff?k=HANDOFF\_VIEW\_KEY



It renders the latest versions of:

\- docs/PRODUCT\_BRIEF.md

\- docs/PRODUCT\_VISION.md

\- docs/TECH\_HANDOFF.md

\- docs/M1\_SMOKE\_TESTS.md

\- docs/STRUCTURE.md (generated)

\- docs/CODE\_INDEX.md (generated)

\- HANDOFF\_PACK.txt (optional generated)



\## How to update / regenerate

Run these scripts locally from repo root:



\### 1) Generate folder structure

powershell:

\- .\\scripts\\gen-structure.ps1



Outputs:

\- docs/STRUCTURE.md



\### 2) Generate code index snapshot

powershell:

\- .\\scripts\\gen-code-index.ps1



Outputs:

\- docs/CODE\_INDEX.md



\## Required commit flow (always)

After generating:

\- git add .

\- git commit -m "Update handoff"

\- git push



\## When starting a new ChatGPT chat

Paste:

1\) The handoff URL

2\) Current milestone + what you want to do next



Workflow rules for assistant:

\- Always provide FULL file replacements

\- Provide PowerShell commit command: git add .; git commit -m "msg"; git push

\- RLS is source of truth; no service-role for user-facing queries

\- If something breaks: read real API response body before guessing



\## Security notes

\- HANDOFF\_VIEW\_KEY must be set in Vercel env vars (Production).

\- Do not expose the key publicly.

\- Do not store secrets in docs files.

