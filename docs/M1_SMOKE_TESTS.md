\# Milestone 1 Smoke Tests (run after any schema/auth change)



\## 1) Build must pass

\- npm run build



\## 2) Dashboard must load

\- https://guestopshq.com/dashboard



\## 3) Memberships RPC must work (RLS)

\- GET /api/me/memberships (Bearer token) -> 200 and array

\- Server RPC: select \* from public.my\_property\_memberships(); (in app context)



\## 4) Conversations API must work (RLS)

\- GET /api/conversations?status=open -> 200 and array

\- No 500 errors like "infinite recursion detected in policy"



\## 5) RLS regression guard

If /api/conversations returns 500:

\- check response body

\- common cause: RLS recursion (properties <-> property\_users). Use property\_org\_id() helper pattern.

