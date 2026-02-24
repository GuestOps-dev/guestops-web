\# GuestOpsHQ — Tech Handoff (Source of Truth)



\## Stack

\- Next.js App Router (Vercel)

\- Supabase (Auth + Postgres + Realtime + RLS)

\- Twilio SMS + WhatsApp



\## Hard rules

\- RLS is the source of truth for isolation

\- No service-role for user-facing queries

\- Service-role only for trusted server-to-server webhooks



\## Current milestone

\- Milestone 2: Canonical Property Workspace

\- InboxClient uses PropertyWorkspaceProvider; debug line shows allowed/selected/apiRows



\## Known sharp edges

\- Avoid RLS recursion between tables (use SECURITY DEFINER helpers for lookups)

