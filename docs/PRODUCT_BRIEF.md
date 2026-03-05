I am building GuestOpsHQ, a multi-property guest communications and operations platform for short-term rentals (Costa Rica-first).

Before proposing architecture changes, assume everything below is the current state of the system.

PRODUCT VISION

GuestOpsHQ is an operations and concierge platform for STR operators.

Core goals:

Reduce repetitive guest communication

Centralize property knowledge

Automate vendor coordination (taxi, chef, tours)

Enable AI-assisted replies with concierge oversight

Enforce strict multi-property isolation (SaaS-ready)

Guests:

Guests do not log in.

Guests communicate via WhatsApp or SMS using Twilio.

Staff:

Staff log in via Supabase Auth.

Staff are assigned to properties.

Role-based access control is enforced.

CURRENT STACK

Next.js 16 (App Router)

Vercel deployment

Supabase (Auth, Postgres, Realtime, RLS)

Twilio SMS and WhatsApp

Supabase Realtime subscriptions working

Bearer-token secured API routes

Middleware protecting /dashboard

Property-scoped RLS

Global admin role supported

DATA MODEL (CORE TABLES)

properties

property_users (many-to-many staff assignment)

profiles (linked to auth.users)

guests

bookings

conversations

inbound_messages

outbound_messages

message_events

vendors

experiences

reminders

phone_numbers

Important notes:

inbound_messages and outbound_messages are separate tables.

conversations are property-scoped.

All operational tables must be property-scoped.

RLS enforces property isolation.

Global admin can bypass property restriction.

AUTH ARCHITECTURE (FINAL STATE)

Browser:

createBrowserClient (@supabase/ssr)

Cookie-based session

Server Components:

getSupabaseRlsServerClient()

RLS-bound and cookie-based

API routes:

requireApiAuth(req)

Authorization header uses Bearer access_token

Supabase client bound to JWT for RLS enforcement

Webhooks (Twilio):

getSupabaseServiceClient()

Uses SUPABASE_SERVICE_ROLE_KEY

Used only for server-to-server operations

Middleware:

Guards only /dashboard/*

APIs use Bearer authentication, not cookies

CURRENT STATUS

Dashboard loads successfully

Property names hydrate correctly

Conversation threads load from inbound_messages and outbound_messages

Twilio inbound writes to inbound_messages

Twilio status updates outbound_messages

Realtime subscriptions work

Role-based property access working

NEXT PRIORITY

We want to move forward cleanly without reactive patching.

Primary goal:

Build a robust, production-grade multi-property role and assignment system and prepare for AI-assisted message drafting.

IMPORTANT WORKFLOW PREFERENCE

When responding:

Always give full file replacements, not partial snippets.

When appropriate, provide Cursor-ready prompts.

Always provide a PowerShell compatible command:

git add .; git commit -m "message"; git push

Keep answers decisive.

Avoid incremental small-fix spirals.

Assume production-grade SaaS architecture.

Minimize unnecessary explanation unless requested.

IMMEDIATE TASK

Before implementing anything new:

Propose the next three milestones in order of architectural importance.

Do not rewrite working auth again.

Do not reintroduce service-role access into user-facing queries.

Keep RLS as the source of truth for isolation.

Then we proceed.

VISION AND POSITIONING

GuestOpsHQ is an operations and concierge platform for short-term rentals, starting with Costa Rica.

It manages guest communication and stay operations from the moment a reservation is created through checkout.

Two-sided product model initially:

Concierge or Operator side

The operational dashboard where concierges manage bookings, guest context, property information, vendors, and experiences.

Guest side

Guests do not log in.

Guests communicate via WhatsApp or SMS.

Core promise:

Reduce repetitive guest questions and operational workload by combining:

Centralized property and stay data

Vendor coordination workflows (taxi, chef, tours)

Proactive reminders

AI-assisted responses that learn from previous answers

Human concierge available for escalation

Market positioning:

Initial focus is STR operators in Costa Rica.

The system will start with your own properties, then expand to other owners and markets.

CORE MESSAGING ENGINE

Channels

Primary channel is WhatsApp.

Secondary fallback is SMS.

Messaging provider is Twilio.

Twilio account has been started with a New Jersey SMS number.

WhatsApp sandbox will be used for MVP testing.

Inbound webhook

Hosted on Vercel using Next.js App Router.

Endpoint: /api/twilio/inbound

Inbound pipeline behavior for MVP:

Twilio sends inbound message to webhook.

Webhook validates Twilio signature.

Message is stored in the database.

Phone numbers are normalized.

Guest is identified by phone.

If no booking exists, a placeholder booking is created.

A conversation thread is created per booking and channel.

Message record is stored.

Twilio signature validation uses x-twilio-signature.

Stored message data includes:

direction (inbound or outbound)

channel (whatsapp or sms)

from and to phone numbers

body

provider and provider_message_id (Twilio MessageSid)

status fields

AI metadata fields

MULTI-PROPERTY ARCHITECTURE

Properties are first-class entities.

System supports:

One concierge managing multiple properties

Multiple concierges assigned to a property

Each property stores:

Structured information (wifi, check-in instructions)

Unstructured knowledge notes used by AI

Sleeping arrangements stored structurally:

rooms

beds

Property vibe system:

Standard vibe catalog

Per-property vibe assignments with weights

Custom property-specific vibes

USER ROLES AND PERMISSIONS

Guests do not log in.

Guests are identified by phone and booking.

Staff users log in via Supabase Auth.

profiles table stores application user metadata.

Roles include:

owner

concierge

admin

optional operations role

Property assignment uses property_users join table.

RLS ensures users can access only assigned properties.

INBOX AND REALTIME REQUIREMENTS

Inbox UI includes:

Conversation list

Thread view

Guest, booking, and property context visible during reply

AI draft suggestions

Concierge approval and send

Realtime updates required for new messages.

Proactive reminders supported.

After-hours AI responses supported.

OPERATIONAL WORKFLOWS

Booking lifecycle

Concierge begins work when booking arrives.

Booking stores:

guest name

arrival and departure dates

property

channel source

check-in details

check-out details

maid schedule

guest party composition

Common guest questions include:

Wi-Fi details

Check-in instructions

Restaurant recommendations

Beach recommendations

Tours and activities

Taxi requests

Troubleshooting issues

Checkout timing

Pickup confirmations

Property knowledge includes:

Wi-Fi details

Check-in instructions

Check-out instructions

Long-form operational notes

Sleeping arrangements stored in:

property_rooms

property_beds

EXPERIENCES

Experiences include:

airport transportation

car rentals

taxis

private chefs

tours

restaurant reservations

Each experience stores:

date and time

guest-facing instructions

internal notes

internal cost

guest price

vendor information

confirmation status

VENDOR COORDINATION

Example: Chef booking

Concierge messages vendor.

Vendor requires guest details.

System collects required fields before booking.

Taxi automation concept:

Round-robin vendor messaging.

Vendor attempts tracked.

Restaurant reservations may use WhatsApp or phone.

AFTER HOURS BEHAVIOR

AI answers common questions.

Urgent keywords trigger concierge escalation.

AUTOMATION AND AI

AI answers repetitive questions.

Concierge can approve drafts.

AI escalates urgent issues.

AI uses property notes and context.

Proactive reminders include:

chef arrival reminders

tour pickup reminders

checkout reminders

Experience knowledge contains:

guest instructions

internal notes

private internal notes

optional structured facts

REPORTING AND METRICS

Potential metrics include:

message volume

guest question frequency

automation rates

vendor responsiveness

concierge workload

response times

LONG TERM SAAS EXPANSION

Start with your properties.

Expand to other property owners.

Expand geographically.

Develop vendor partnerships.

Integrate booking platforms.

BUSINESS MODEL IDEAS

Subscription per property.

Add-ons for AI usage.

Vendor referral commissions.

ARCHITECTURAL DECISIONS

Backend database and auth: Supabase

Frontend and webhooks: Next.js on Vercel

Messaging: Twilio

AI integration planned.

Data modeling rules:

Guests are persistent identities.

Party composition belongs to booking.

Bookings include source reservation ID.

Experiences are generalized service items.

Guest-facing and internal notes are separated.

SCHEMA VERSION 1

Core tables include:

properties

property_rooms

property_beds

guests

bookings

conversations

messages

vendors

vendor_requirements

experience_types

experiences

experience_media

vendor_requests

reminders

vibe_catalog

property_vibes

property_custom_vibes

profiles

property_users

RLS AND ACCESS CONTROL

RLS enabled on key tables.

Helper SQL functions include:

is_assigned_to_property(property_id)

is_active_profile()

Policies enforce property-based access.

Inbound webhook implemented.

Next.js Twilio webhook route created.

Placeholder bookings supported for MVP.

SECURITY AND COMPLIANCE

RLS ensures tenant isolation.

Supabase service keys stay server-side.

Twilio signature validation prevents spoofing.

Internal notes separated from guest-facing data.

A2P 10DLC compliance planned later.

WhatsApp business approval planned later.

CURRENT MILESTONE STATUS

Step 1: MVP scope agreed.

Step 2: Database schema created.

Step 3: Supabase Auth and RLS implemented.

Step 4A: Twilio account created and SMS number purchased.

Step 4B: Next.js project created and webhook route implemented.

NEXT TASKS

Deploy to Vercel.

Configure Twilio inbound webhooks.

Verify messages land in Supabase.

Create outbound messaging endpoint.

Build Inbox UI.

Add AI draft functionality.

PRODUCT RULES

Guests do not log in.

Identity is phone plus booking.

AI handles repetitive questions.

Concierge handles escalation.

Proactive reminders reduce inbound messages.

Vendor bookings should become structured workflows.

Property vibe system improves recommendation tone.

Most Recent Notes as of 3/4/26

### Guest Profile / Guest Linking

conversations.guest_id exists (nullable uuid FK -> guests.id)

Guest tables in play: guests, guest_properties, guest_notes

Linking is enforced by DB trigger ensure_conversation_guest_link calling public.ensure_conversation_guest_link()

Important gotcha: trigger must be BEFORE INSERT OR UPDATE (AFTER triggers can’t set NEW.guest_id)

Backfill command used:

update public.conversations set updated_at = now() where guest_id is null;

Confirm query:

select count(*) total, count(guest_id) linked from public.conversations;

### Quick Replies

quick_replies table exists + seeded rows

UI button “Quick Replies” in conversation composer

Note any columns that actually exist (ex: no sort_order)

### Assign / Claim (RLS + permissions)

If “Claim” fails, it’s usually RLS/GRANT/policy on conversations updates

Final fix was granting/policy update (whatever you ran) + now claim persists