I am building GuestOpsHQ, a multi-property guest communications and operations platform for short-term rentals (Costa Rica-first).



Before proposing architecture changes, assume everything below is the current state of the system.



PRODUCT VISION



GuestOpsHQ is an operations + concierge platform for STR operators.



Core goals:



Reduce repetitive guest communication



Centralize property knowledge



Automate vendor coordination (taxi, chef, tours)



Enable AI-assisted replies with concierge oversight



Enforce strict multi-property isolation (SaaS-ready)



Guests:



Do NOT login



Communicate via WhatsApp or SMS (Twilio)



Staff:



Login via Supabase Auth



Assigned to properties



Role-based access control



CURRENT STACK



• Next.js 16 (App Router)

• Vercel deployment

• Supabase (Auth + Postgres + Realtime + RLS)

• Twilio SMS + WhatsApp

• Supabase Realtime subscriptions working

• Bearer-token secured API routes

• Middleware protecting /dashboard

• Property-scoped RLS

• Global admin role supported



DATA MODEL (CORE TABLES)



properties



property\_users (many-to-many staff assignment)



profiles (linked to auth.users)



guests



bookings



conversations



inbound\_messages



outbound\_messages



message\_events



vendors



experiences



reminders



phone\_numbers



Important:



inbound\_messages and outbound\_messages are separate tables



conversations is property-scoped



All operational tables must be property-scoped



RLS enforces property isolation



Global admin can bypass property restriction



AUTH ARCHITECTURE (FINAL STATE)



Browser:



createBrowserClient (@supabase/ssr)



Cookie-based session



Server Components:



getSupabaseRlsServerClient() (RLS-bound, cookie-based)



API routes:



requireApiAuth(req)



Authorization: Bearer <access\_token>



Supabase client bound to JWT for RLS enforcement



Webhooks (Twilio):



getSupabaseServiceClient()



Uses SUPABASE\_SERVICE\_ROLE\_KEY



Only server-to-server operations



Middleware:



Guards ONLY /dashboard/\*



APIs use Bearer auth, not cookies



CURRENT STATUS



✅ Dashboard loads

✅ Property names hydrate correctly

✅ Conversation threads load from inbound\_messages + outbound\_messages

✅ Twilio inbound writes to inbound\_messages

✅ Twilio status updates outbound\_messages

✅ Realtime subscriptions work

✅ Role-based property access working



NEXT PRIORITY



We want to move forward cleanly without more reactive patching.



Primary goal:



Build a robust, production-grade multi-property role + assignment system and prepare for AI-assisted message drafting.



IMPORTANT WORKFLOW PREFERENCE



When responding:



Always give FULL file replacements (not partial snippets).



When appropriate, provide Cursor-ready prompts.



Always provide a PowerShell-compatible:

git add .; git commit -m "message"; git push



Keep answers decisive.



Avoid incremental “small fix” spirals.



Assume production-grade SaaS architecture.



Minimize unnecessary explanation unless requested.



IMMEDIATE TASK



Before implementing anything new:



Propose the next 3 milestones in order of architectural importance.



Do not rewrite working auth again.



Do not reintroduce service-role into user-facing queries.



Keep RLS as source of truth for isolation.



Then we proceed.





Vision \& Positioning



What it is: GuestOpsHQ is an operations + concierge platform for short-term rentals (STRs) (Costa Rica-first), built to handle guest communication and stay operations from the moment a reservation is created through checkout.



Two-sided product (initially):



Concierge/Operator side: The operational dashboard where concierges manage bookings, guest context, property info, vendors, and experiences.



Guest side: No login. Guests communicate via WhatsApp or SMS (depending on preference).



Core promise: Reduce repetitive guest questions and operational load by combining:



Centralized property \& stay data



Vendor coordination workflows (taxi/chef/tours)



Proactive reminders



AI-assisted responses that learn from previous answers



Human concierge always available for escalation



Market positioning: Built for STR operators in Costa Rica (Airbnb tourism heavy) as initial wedge; expands to other towns and eventually broader STR markets. Designed to start with your properties, then sell to other owners/operators.



Core Messaging Engine



Channels:



Primary: WhatsApp (guest-preferred in Costa Rica travel context)



Secondary/Fallback: SMS



Messaging provider: Twilio (fresh account started; NJ local SMS number purchased; WhatsApp sandbox planned for MVP testing).



Inbound webhook: Hosted on Vercel + Next.js, endpoint:



/api/twilio/inbound (Next.js App Router API route)



Inbound pipeline behavior (MVP):



Twilio sends inbound message → webhook validates Twilio signature → stores message in DB.



Normalizes phone formats (whatsapp:+...).



Creates/uses:



guest (by phone)



booking (placeholder booking if no matching booking exists yet)



conversation thread per booking + channel



message record



Twilio signature validation: Implemented in webhook using Twilio’s request validation (x-twilio-signature).



Message storage includes:



direction (inbound/outbound)



channel (whatsapp/sms)



from/to phone



body



provider + provider\_message\_id (Twilio MessageSid)



status fields (received/sent/etc.)



AI metadata (drafted\_by\_ai, approved\_by\_profile\_id)



Multi-Property Architecture



Properties are first-class.



Designed for:



One concierge managing multiple properties



Multiple concierges per property



Property holds both:



Structured info (wifi, check-in/out)



Unstructured “knowledge base” notes for AI



Sleeping arrangements modeled structurally (rooms + beds) for accurate answers and nice UI display.



Vibe system per property:



Standard vibe catalog + per-property assignments (weighted)



Custom vibes per property for unique “soul”/nuance (weighted + guest-facing toggle)



User Roles \& Permissions



Guests: No login, no auth, identified by phone and booking context.



Staff users: Use Supabase Auth (auth.users) for login.



Profiles table: App-specific user metadata linked 1:1 to Supabase Auth user id.



Roles discussed:



owner



concierge



admin



(optionally ops)



Property assignment: Many-to-many via property\_users join table.



RLS enforcement: Users can only access data for properties they’re assigned to (via helper functions).



Inbox \& Realtime Requirements



Inbox-style UI is a key MVP screen:



List of conversations



Thread view with messages



Guest + booking + property context visible while replying



AI drafts suggested, concierge approves/sends (at least initially)



Realtime: Mentioned desire for “Realtime Inbox Plan”; implied need for near-real-time updates/refresh.



Proactive reminders: System should schedule messages (e.g., “chef at 5pm”) and support after-hours handling.



Operational Workflows

Booking lifecycle



Concierge starts working as soon as booking arrives.



Booking stores:



guest name



arrival/departure dates



property (Airbnb/VRBO/etc.)



check-in/out details



maid schedule + maid name (planned)



guest party composition: adults/children/infants (moved to booking, not guest)



Common guest questions (validated from WhatsApp exports)



Top recurring patterns:



Wi-Fi password/network



Check-in / arrival directions \& gate access



Restaurant recommendations



Beach recommendations



Hikes / activities



Taxi requests



Tour/excursion questions



Troubleshooting: toilet clogged, TV not working, power outage



Re-confirmations: checkout time, pickup times



“Just checking / reassurance” type messages (tone matters)



Property knowledge



Properties must store:



Wi-Fi SSID/password



Check-in instructions



Check-out instructions



Long-form notes (short or long) used by AI for Q\&A (“where is breaker panel”, etc.)



Sleeping arrangements stored in structured tables:



rooms



beds



Experiences (formerly “tours”)



Experiences cover:



airport rides



car rentals



taxis



private chefs



excursions/tours



reservations (restaurants eventually)



Experience needs:



date/time



guest-facing instructions



internal notes for AI \& ops



internal cost and guest price



vendor/contact relationship



confirmation reference/status



Vendor coordination workflows



Chef booking example:



Orlando messages vendor “Marlon” via WhatsApp



Vendor requires guest email, name, number of guests, etc.



System should know required fields and collect them before booking.



Taxi automation concept:



Orlando texts preferred taxi drivers in order until someone accepts.



System should automate round-robin:



message vendor 1 → wait → if no/decline → vendor 2 → etc.



Track attempts and outcomes.



Restaurant reservations workflow



Unknown whether Orlando calls or WhatsApps restaurants; system should support both methods.



After-hours behavior



AI can answer common questions after hours.



If urgent keywords or issues arise, system should escalate / wake concierge.



Automation \& AI Possibilities



AI role: Answer most repetitive questions, learn from prior answers, keep concierge in loop.



Personality: Each concierge can define their own personality/tone.



Context awareness:



AI can infer if guest has a car from prior conversations / booking state.



AI uses property notes, vibe, and experience instructions to answer accurately.



Response types:



Auto-answer safe FAQs (wifi, check-in/out, directions, basic recommendations)



AI draft → concierge approve for sensitive/edge cases



Always escalate for safety/urgent issues (power outage prolonged, access issues, explicit “call me”, etc.)



Proactive reminders (automation):



Chef coming at 5pm



Catamaran pickup at 7am; bring bug spray; includes fruit/juice



Checkout reminders, airport ride reminders



Experience knowledge lanes (critical):



Guest-facing instructions



Internal notes (guest-safe facts AI can share)



Internal private notes (costs/commission/vendor quirks; must not be exposed)



Optional structured “facts” for experiences: JSON-style facts like “no water bottles allowed”, “4WD required”, etc. (discussed as possible v1.5 improvement).



Reporting \& Metrics (implied/desired)



Not fully designed yet, but directionally:



Message volume by property/stay



Top guest intents/questions frequency



Automation rate:



% auto-answered



% AI-drafted then approved



% escalated



Vendor responsiveness:



taxi drivers response time / accept rate



Concierge workload:



messages per stay



after-hours escalations



Quality signals:



time-to-first-response



time-to-resolution for incidents (TV/toilet/power)



Long-Term SaaS Expansion



Start with your properties → sell to other owners you know → expand to other towns → hire concierge sales + operations staffing.



Future direction includes:



vendor partnerships willing to work with platform (car rental, etc.)



deeper reservation integrations (Airbnb/VRBO/Booking.com) and/or PMS integrations



scaling concierge teams and cross-property operations



vendor booking via APIs where available



restaurant reservation workflows integrated (WhatsApp/call/online)



Possible product packaging:



Multi-tenant SaaS with property owners as customers



Concierge teams as users within each customer



Business Model Ideas Discussed



Start with your properties to prove value.



Sell to other property owners/operators (subscription SaaS).



Potential vendor partnership/commission layer later (car rentals, tours, etc.).



Not deeply priced yet, but implied revenue drivers:



SaaS subscription per property or per unit



Add-ons for messaging volume, AI usage, automation modules



Vendor referral/commission in future



Architectural Decisions Already Made

Stack \& hosting



Backend database + auth: Supabase



Frontend + webhooks host: Next.js (App Router) deployed to Vercel



Messaging provider: Twilio (SMS + WhatsApp)



AI: OpenAI/ChatGPT integration planned (drafting + Q\&A + automation)



Data modeling principles



Guests are persistent identities (phone-based), but party composition belongs to booking.



Bookings include STR channel + external reservation ID to avoid duplicates.



Experiences are generalized “line items” across many categories (transport, chef, tours, etc.).



Separate guest-facing vs internal-only notes to prevent leakage.



Property knowledge includes structured fields + long-form notes + sleeping arrangement tables.



Many-to-many relationships for staff↔property via join table.



Schema created (v1)



Core tables:



properties



property\_rooms



property\_beds



guests



bookings (includes source and source\_reservation\_id with unique constraint per property)



conversations



messages



vendors



vendor\_requirements



experience\_types



experiences



experience\_media (photos stored via Supabase Storage paths)



vendor\_requests (to track round-robin outreach attempts)



reminders



vibe\_catalog



property\_vibes



property\_custom\_vibes



profiles (linked to auth.users)



property\_users



RLS \& access control



Row Level Security enabled on key tables.



Helper SQL functions:



is\_assigned\_to\_property(property\_id)



is\_active\_profile()



Policies enforce property-scoped access via property\_users.



Inbound webhook created



Next.js API route implemented for Twilio inbound.



Signature validation enabled.



Placeholder booking creation used for MVP until booking imports are added.



Security / Compliance Considerations Mentioned



RLS enabled early to ensure future SaaS safety and proper data isolation.



Service secret key (Supabase “secret key”) must remain server-side only (never shipped to frontend).



Twilio signature validation to prevent spoofed inbound webhooks.



Separation of internal/private notes vs guest-facing content to prevent accidental disclosure (especially costs/commission/vendor details).



A2P 10DLC warning acknowledged: SMS compliance needed later for US messaging at scale (not blocking MVP).



WhatsApp business approval noted as later step (sandbox first).



Emergency address warning in Twilio noted as irrelevant for SMS/WhatsApp use case.



Where implementation currently stands (milestone status)



✅ Step 1: MVP scope agreed



✅ Step 2: Database schema created in Supabase



✅ Step 3: Supabase Auth + profiles + property assignments + RLS policies implemented



✅ Step 4A: Twilio account started fresh; NJ SMS number purchased; WhatsApp sandbox planned



✅ Step 4B: Next.js project created locally; env configured; webhook route added; dev server restarted clean



⏭ Next immediate tasks:



Deploy to Vercel



Configure Twilio inbound webhook URLs (SMS number + WhatsApp sandbox)



Verify inbound message lands in Supabase



Add outbound messaging endpoint (send replies)



Begin Inbox UI screen + AI drafting (later steps)



Notes on key product behaviors (important “rules”)



Guests do not login; identity is by phone + booking.



AI should handle repetitive questions and reassurance, but:



escalate urgent/safety/access issues



allow concierge jump-in any time



Proactive reminders reduce inbound volume and improve guest experience.



Vendor booking should become structured:



required info collection



booking attempts tracking



confirmation capture



Property vibe and custom vibes improve recommendation tone and accuracy





