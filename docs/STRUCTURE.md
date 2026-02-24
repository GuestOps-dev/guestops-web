# GuestOpsHQ - Important Folder Structure

Generated: 2026-02-24 16:40:30

This is a CURATED tree (only files that matter for architecture + day-to-day dev).


## 
App (Routes + UI)

### .\app
---
    api\conversations\[id]\read\route.ts
    api\conversations\route.ts
    api\messages\send\route.ts
    api\properties\route.ts
    api\twilio\inbound\route.ts
    api\twilio\status\route.ts
    dashboard\conversations\[id]\LiveThread.tsx
    dashboard\conversations\[id]\MarkRead.tsx
    dashboard\conversations\[id]\OutboundBubble.tsx
    dashboard\conversations\[id]\page.tsx
    dashboard\conversations\[id]\SendMessageBox.tsx
    dashboard\InboxClient.tsx
    dashboard\page.tsx
    dashboard\PropertyWorkspaceProvider.tsx
    layout.tsx
---


## 
Source (Libraries)

### .\src
---
    app\api\me\memberships\route.ts
    lib\access\fetchMembershipsClient.ts
    lib\access\getMyMemberships.ts
    lib\access\validateSelectedProperty.ts
    lib\api\requireApiAuth.ts
    lib\serverAuth.ts
    lib\supabase\getSupabaseRlsServerClient.ts
    lib\supabaseApiAuth.ts
    lib\supabaseBrowser.ts
    lib\supabaseServer.ts
---


## 
Supabase (Migrations / Policies)

### .\supabase
---
    migrations\20260224_000001_orgs_property_roles_rls.sql
    migrations\20260224_000002_canonical_can_access_property.sql
    migrations\20260224_fix_rls_recursion.sql
---


## 
Docs

### .\docs
---
    M1_SMOKE_TESTS.md
    Product_Brief.md
    PRODUCT_VISION.md
    TECH_HANDOFF.md
---

