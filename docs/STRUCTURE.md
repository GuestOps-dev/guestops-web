# GuestOpsHQ — Filtered Repo Structure (Generated)

Only showing relevant file extensions: .ts, .tsx, .js, .mjs, .json, .sql, .md, .yaml, .yml, .env

```
├─ app
│  ├─ api
│  │  ├─ admin
│  │  │  └─ route.ts
│  │  ├─ conversations
│  │  │  ├─ [id]
│  │  │  │  ├─ assign
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ messages
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ outbound
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ read
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ status
│  │  │  │     └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ me
│  │  │  └─ memberships
│  │  │     └─ route.ts
│  │  ├─ messages
│  │  │  └─ send
│  │  │     └─ route.ts
│  │  ├─ properties
│  │  │  └─ route.ts
│  │  └─ twilio
│  │     ├─ inbound
│  │     │  └─ route.ts
│  │     └─ status
│  │        └─ route.ts
│  ├─ dashboard
│  │  ├─ conversations
│  │  │  └─ [id]
│  │  │     ├─ LiveThread.tsx
│  │  │     ├─ MarkRead.tsx
│  │  │     ├─ OutboundBubble.tsx
│  │  │     ├─ page.tsx
│  │  │     └─ SendMessageBox.tsx
│  │  ├─ InboxClient.tsx
│  │  ├─ page.tsx
│  │  └─ PropertyWorkspaceProvider.tsx
│  ├─ layout.tsx
│  ├─ login
│  │  └─ page.tsx
│  ├─ ops
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ handoff
│  │  │  └─ page.tsx
│  │  └─ inbox
│  │     ├─ OpsInboxRow.tsx
│  │     ├─ page.tsx
│  │     └─ PropertyFilter.tsx
│  ├─ page.tsx
│  ├─ privacy
│  │  └─ page.tsx
│  ├─ reset-password
│  │  └─ page.tsx
│  └─ sms-terms
│     └─ page.tsx
├─ docs
│  ├─ CODE_INDEX.md
│  ├─ HANDOFF_README.md
│  ├─ M1_SMOKE_TESTS.md
│  ├─ PRODUCT_BRIEF.md
│  ├─ PRODUCT_VISION.md
│  ├─ STRUCTURE.md
│  └─ TECH_HANDOFF.md
├─ eslint.config.mjs
├─ middleware.ts
├─ next-env.d.ts
├─ next.config.ts
├─ package.json
├─ postcss.config.mjs
├─ README.md
├─ scripts
│  └─ gen-handoff-index.mjs
├─ src
│  ├─ app
│  │  └─ api
│  │     ├─ me
│  │     │  └─ memberships
│  │     │     └─ route.ts
│  │     └─ profiles
│  │        └─ lookup
│  │           └─ route.ts
│  └─ lib
│     ├─ access
│     │  ├─ fetchMembershipsClient.ts
│     │  ├─ getMyMemberships.ts
│     │  └─ validateSelectedProperty.ts
│     ├─ api
│     │  └─ requireApiAuth.ts
│     ├─ serverAuth.ts
│     ├─ supabase
│     │  └─ getSupabaseRlsServerClient.ts
│     ├─ supabaseAdmin.ts
│     ├─ supabaseApiAuth.ts
│     ├─ supabaseBrowser.ts
│     └─ supabaseServer.ts
├─ supabase
│  └─ migrations
│     ├─ 20260224_000001_orgs_property_roles_rls.sql
│     ├─ 20260224_000002_canonical_can_access_property.sql
│     └─ 20260224_fix_rls_recursion.sql
└─ tsconfig.json
```
