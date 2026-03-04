# GuestOpsHQ — CODE INDEX (Generated)

Generated: 2026-03-04T18:26:21.558Z
Git SHA: 200adbe

---

## API Routes

- **/api/admin** (GET)  
  - file: `app/api/admin/route.ts`
- **/api/conversations/[id]/assign** (POST)  
  - file: `app/api/conversations/[id]/assign/route.ts`
- **/api/conversations/[id]/messages** (GET)  
  - file: `app/api/conversations/[id]/messages/route.ts`
- **/api/conversations/[id]/outbound** (POST)  
  - file: `app/api/conversations/[id]/outbound/route.ts`
- **/api/conversations/[id]/read** (POST)  
  - file: `app/api/conversations/[id]/read/route.ts`
- **/api/conversations/[id]/status** (POST)  
  - file: `app/api/conversations/[id]/status/route.ts`
- **/api/conversations** (GET)  
  - file: `app/api/conversations/route.ts`
- **/api/me/memberships** (GET)  
  - file: `app/api/me/memberships/route.ts`
- **/api/messages/send** (POST)  
  - file: `app/api/messages/send/route.ts`
- **/api/properties** (GET)  
  - file: `app/api/properties/route.ts`
- **/api/twilio/inbound** (POST)  
  - file: `app/api/twilio/inbound/route.ts`
- **/api/twilio/status** (POST)  
  - file: `app/api/twilio/status/route.ts`
- **/api/me/memberships** (GET)  
  - file: `src/app/api/me/memberships/route.ts`
- **/api/profiles/lookup** (POST)  
  - file: `src/app/api/profiles/lookup/route.ts`

## Key Areas (exists in repo)

- `src/lib`
- `supabase/migrations`
- `docs`

## Environment Variables Referenced in Code

- `HANDOFF_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

## Notes

- This index intentionally scans BOTH `app/` and `src/` layouts to prevent “path mismatch” across chats.
- Keep “handoff” content in repo files so the app can render it at /ops/handoff.
