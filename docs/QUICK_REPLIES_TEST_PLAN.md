# Quick Replies – Manual Test Plan

Use this for PR description or QA.

## Prerequisites
- Logged-in user with access to at least one property.
- For management: user is admin **or** has `property_manager` / `ops` role on that property.

## 1. Picker in conversation thread
1. Go to **Dashboard** → open any conversation (or create one).
2. In the message composer, click **Quick Replies**.
3. **Expect:** Modal opens with list of active quick replies for that conversation’s property (or “No quick replies found” if none).
4. Use the **search** box; filter by title or body.
5. **Expect:** List filters as you type.
6. **Expect:** Each item shows a **category** label; null category shows **General**.
7. Click a reply.
8. **Expect:** Modal closes and the reply’s **body** is inserted into the textarea. If the textarea already had text, the body is appended after a newline.
9. Send the message (or clear) and repeat; confirm no duplicates or wrong insert.

## 2. Manage Quick Replies link (conversation page)
1. As **admin** or **property_manager**/ops for a property: open a conversation for that property.
2. **Expect:** A **Manage Quick Replies** link appears in the header (next to status badge).
3. As a **concierge** (or non-manager) for that property only: open the same conversation.
4. **Expect:** **Manage Quick Replies** link is **not** visible.
5. Click **Manage Quick Replies** (as admin/manager).
6. **Expect:** Navigate to `/dashboard/properties/[propertyId]/quick-replies` for that property.

## 3. Management panel – list and create
1. Go to **Dashboard** → open a conversation → **Manage Quick Replies** (or go directly to `/dashboard/properties/[propertyId]/quick-replies` with a valid `propertyId`).
2. **Expect:** Page title “Quick Replies” and property name; “New quick reply” form at top.
3. Create a quick reply: **Title** “Test”, **Body** “Hello world”, **Category** “Greeting” (or leave blank for General), **Active** checked. Submit **Create**.
4. **Expect:** New row appears in the list; form clears.
5. **Expect:** List shows title, category (or “General”), body preview; **Active** checkbox, **Edit**, **Delete**.

## 4. Management panel – edit and active toggle
1. Click **Edit** on a row. Inline fields appear (title, body, category, active).
2. Change title/body/category; toggle **Active** off. Click **Save**.
3. **Expect:** Row updates; inactive rows have muted styling and “(inactive)”.
4. In the conversation thread, open **Quick Replies** again.
5. **Expect:** The deactivated reply does **not** appear in the picker (only active replies are returned for the composer).
6. Re-edit and set **Active** back on; confirm it reappears in the picker.

## 5. Management panel – delete
1. Click **Delete** on a reply; confirm in the dialog.
2. **Expect:** Row is removed from the list and no longer appears in the Quick Replies picker.

## 6. Access control
1. As a user who is **not** admin and has **no** `property_manager`/`ops` role on a property, open `/dashboard/properties/[thatPropertyId]/quick-replies` directly.
2. **Expect:** 404 (not found).
3. **Expect:** That user does not see **Manage Quick Replies** on the conversation page for that property.

## 7. API (optional)
- **GET** `/api/quick-replies?propertyId=<uuid>`: 401 without auth; 400 without/invalid `propertyId`; 200 with array ordered by category (nulls last) then title; only active if not `activeOnly=false`.
- **POST** `/api/quick-replies`: body `property_id`, `title`, `body`; optional `category`, `is_active`; 201 with created row.
- **PATCH** `/api/quick-replies/[id]`: body any of `title`, `body`, `category`, `is_active`; 200 with updated row.
- **DELETE** `/api/quick-replies/[id]`: 200; 403/404 when not allowed or missing.
