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



\## 6) Conversation thread (M1)

\- **Open thread:** Open /dashboard/conversations/[id] for a conversation you can access. Page must show header (property name, guest number, status badge) and message timeline (inbound vs outbound visually distinct). GET /api/conversations/[id]/thread (Bearer or cookie) returns { conversation, inbound[], outbound[] }.

\- **Send outbound:** On the same thread page, send a reply. POST /api/conversations/[id]/outbound with body { body } must create an outbound_messages row and update conversation last_outbound_at + last_message_at. After send, thread refreshes (e.g. router.refresh() or refetch).

\- **Mark read:** When the thread page loads, POST /api/conversations/[id]/read is called (with property_id in body). conversations.last_read_at is set to now. Unread = last_inbound_at > last_read_at; after viewing the thread, unread count in inbox should drop.

