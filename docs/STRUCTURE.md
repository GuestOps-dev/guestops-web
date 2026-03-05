# GuestOpsHQ - Important Folder Structure

Generated: 2026-03-04 19:52:37

This is a CURATED tree (only files that matter for architecture + day-to-day dev).


## 
App (Routes + UI)

### .\app
---
    api\admin\route.ts
    api\conversations\[id]\assign\route.ts
    api\conversations\[id]\internal-notes\route.ts
    api\conversations\[id]\messages\route.ts
    api\conversations\[id]\outbound\route.ts
    api\conversations\[id]\read\route.ts
    api\conversations\[id]\status\route.ts
    api\conversations\[id]\thread\route.ts
    api\conversations\route.ts
    api\guests\[id]\notes\route.ts
    api\guests\[id]\route.ts
    api\me\memberships\route.ts
    api\messages\send\route.ts
    api\profiles\lookup\route.ts
    api\properties\route.ts
    api\quick-replies\[id]\route.ts
    api\quick-replies\route.ts
    api\twilio\inbound\route.ts
    api\twilio\status\route.ts
    dashboard\conversations\[id]\GuestProfilePanel.tsx
    dashboard\conversations\[id]\InternalNotesSection.tsx
    dashboard\conversations\[id]\LiveThread.tsx
    dashboard\conversations\[id]\MarkRead.tsx
    dashboard\conversations\[id]\OutboundBubble.tsx
    dashboard\conversations\[id]\page.tsx
    dashboard\conversations\[id]\QuickReplyPicker.tsx
    dashboard\conversations\[id]\SendMessageBox.tsx
    dashboard\InboxClient.tsx
    dashboard\page.tsx
    dashboard\properties\[propertyId]\quick-replies\page.tsx
    dashboard\properties\[propertyId]\quick-replies\PropertyQuickRepliesManager.tsx
    dashboard\PropertyWorkspaceProvider.tsx
    dashboard\quick-replies\page.tsx
    dashboard\quick-replies\QuickRepliesAdmin.tsx
    layout.tsx
---


## 
Source (Libraries)

### .\src
---
    app\api\me\memberships\route.ts
    app\api\profiles\lookup\route.ts
    lib\access\fetchMembershipsClient.ts
    lib\access\getMyMemberships.ts
    lib\access\validateSelectedProperty.ts
    lib\api\requireApiAuth.ts
    lib\serverAuth.ts
    lib\supabase\getSupabaseRlsServerClient.ts
    lib\supabaseAdmin.ts
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
    migrations\20260305000001_quick_replies.sql
    migrations\20260324000001_internal_notes.sql
---


## 
Docs

### .\docs
---
    CODE_INDEX.md
    HANDOFF_README.md
    M1_SMOKE_TESTS.md
    PRODUCT_BRIEF.md
    PRODUCT_VISION.md
    QUICK_REPLIES_TEST_PLAN.md
    ROADMAP.md
    STRUCTURE.md
    TECH_HANDOFF.md
---

