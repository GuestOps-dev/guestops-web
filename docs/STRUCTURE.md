# GuestOpsHQ — Filtered Repo Structure (Generated)

Only showing relevant file extensions: .ts, .tsx, .js, .mjs, .json, .sql, .md, .yaml, .yml, .env

```
├─ app
│  ├─ api
│  │  ├─ admin
│  │  │  └─ route.ts
│  │  ├─ bookings
│  │  │  └─ [id]
│  │  │     └─ route.ts
│  │  ├─ conversations
│  │  │  ├─ [id]
│  │  │  │  ├─ assign
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ internal-notes
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ messages
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ outbound
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ priority
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ read
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ status
│  │  │  │  │  └─ route.ts
│  │  │  │  ├─ stay
│  │  │  │  │  └─ route.ts
│  │  │  │  └─ thread
│  │  │  │     └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ experience-types
│  │  │  ├─ [id]
│  │  │  │  └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ experiences
│  │  │  ├─ [id]
│  │  │  │  └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ guests
│  │  │  └─ [id]
│  │  │     ├─ notes
│  │  │     │  └─ route.ts
│  │  │     ├─ route.ts
│  │  │     └─ tags
│  │  │        └─ route.ts
│  │  ├─ me
│  │  │  └─ memberships
│  │  │     └─ route.ts
│  │  ├─ messages
│  │  │  └─ send
│  │  │     └─ route.ts
│  │  ├─ profiles
│  │  │  └─ lookup
│  │  │     └─ route.ts
│  │  ├─ properties
│  │  │  ├─ [id]
│  │  │  │  └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ quick-replies
│  │  │  ├─ [id]
│  │  │  │  └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ tasks
│  │  │  ├─ [id]
│  │  │  │  └─ route.ts
│  │  │  └─ route.ts
│  │  ├─ twilio
│  │  │  ├─ inbound
│  │  │  │  └─ route.ts
│  │  │  └─ status
│  │  │     └─ route.ts
│  │  └─ vendors
│  │     ├─ [id]
│  │     │  └─ route.ts
│  │     └─ route.ts
│  ├─ dashboard
│  │  ├─ conversations
│  │  │  └─ [id]
│  │  │     ├─ ConversationPrioritySelect.tsx
│  │  │     ├─ ConversationServices.tsx
│  │  │     ├─ ConversationStatusSelect.tsx
│  │  │     ├─ ConversationTasks.tsx
│  │  │     ├─ GuestProfilePanel.tsx
│  │  │     ├─ LiveThread.tsx
│  │  │     ├─ MarkRead.tsx
│  │  │     ├─ OutboundBubble.tsx
│  │  │     ├─ page.tsx
│  │  │     ├─ QuickReplyPicker.tsx
│  │  │     └─ SendMessageBox.tsx
│  │  ├─ InboxClient.tsx
│  │  ├─ page.tsx
│  │  ├─ properties
│  │  │  ├─ [propertyId]
│  │  │  │  └─ quick-replies
│  │  │  │     ├─ page.tsx
│  │  │  │     └─ PropertyQuickRepliesManager.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ PropertyGuideManager.tsx
│  │  ├─ PropertyWorkspaceProvider.tsx
│  │  ├─ quick-replies
│  │  │  ├─ page.tsx
│  │  │  └─ QuickRepliesAdmin.tsx
│  │  └─ vendors
│  │     ├─ page.tsx
│  │     ├─ ServiceTypesManager.tsx
│  │     └─ VendorsManager.tsx
│  ├─ forgot-password
│  │  └─ page.tsx
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
│  ├─ sms-consent
│  │  └─ page.tsx
│  └─ sms-terms
│     └─ page.tsx
├─ docs
│  ├─ CODE_INDEX.md
│  ├─ DEPLOYMENT.md
│  ├─ HANDOFF_README.md
│  ├─ M1_SMOKE_TESTS.md
│  ├─ migrations
│  │  ├─ 001_guest_profile.sql
│  │  └─ 002_conversation_priority.sql
│  ├─ PRODUCT_BRIEF.md
│  ├─ PRODUCT_VISION.md
│  ├─ QUICK_REPLIES_TEST_PLAN.md
│  ├─ ROADMAP.md
│  ├─ STRUCTURE.md
│  └─ TECH_HANDOFF.md
├─ eslint.config.mjs
├─ next-env.d.ts
├─ next.config.ts
├─ package.json
├─ postcss.config.mjs
├─ proxy.ts
├─ README.md
├─ scripts
│  ├─ gen-handoff-index.mjs
│  └─ smoke-production.mjs
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
│     ├─ supabaseApiAuth.ts
│     ├─ supabaseBrowser.ts
│     ├─ supabaseServer.ts
│     └─ twilioWebhookUrl.ts
├─ supabase
│  └─ migrations
│     ├─ 20260224_000001_orgs_property_roles_rls.sql
│     ├─ 20260224_000002_canonical_can_access_property.sql
│     ├─ 20260224_fix_rls_recursion.sql
│     ├─ 20260305000001_quick_replies.sql
│     ├─ 20260324000001_internal_notes.sql
│     ├─ 20260911_000001_secure_guest_data.sql
│     ├─ 20260911_000002_remove_legacy_message_read_policies.sql
│     ├─ 20260911_000003_create_sms_opt_in_consents.sql
│     ├─ 20260911_000004_message_idempotency_indexes.sql
│     ├─ 20260911_000005_add_booking_stay_dates.sql
│     ├─ 20260912_000001_revoke_anonymous_guest_data_reads.sql
│     ├─ 20260912_000002_pin_public_function_search_paths.sql
│     ├─ 20260912_000003_create_conversation_tasks.sql
│     ├─ 20260912_000004_secure_vendor_coordination.sql
│     ├─ 20260912_000005_revoke_anonymous_task_reads.sql
│     └─ 20260912_000006_add_property_ai_guide.sql
└─ tsconfig.json
```
