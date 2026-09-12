# GuestOpsHQ deployment checklist

## 1. Deploy from GitHub

Import `GuestOps-dev/guestops-web` into Vercel and deploy the `main` branch.
Use the default Next.js build settings:

- Build command: `npm run build`
- Install command: `npm install`
- Output directory: leave empty

## 2. Configure Vercel environment variables

Add the following values to both Production and Preview. Never commit the
server-only values or expose them in client-side variables.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Supabase publishable key |
| `NEXT_PUBLIC_APP_URL` | Browser + server | Production HTTPS origin, without a trailing slash |
| `SUPABASE_URL` | Server only | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Trusted Twilio webhook writes only |
| `TWILIO_ACCOUNT_SID` | Server only | Twilio account ID |
| `TWILIO_AUTH_TOKEN` | Server only | Validates Twilio signatures and sends SMS |
| `LODGIFY_API_KEY` | Server only | Reads mapped rentals and reservation data from Lodgify |
| `LODGIFY_WEBHOOK_SECRET` | Optional, server only | Manual override for a signed Lodgify webhook; normally stored internally after activation |
| `DEFAULT_PROPERTY_ID` | Optional | Local development fallback only |

After adding variables, redeploy the production deployment.

## 3. Configure Twilio webhooks

Use the production origin from `NEXT_PUBLIC_APP_URL`:

- Incoming messages: `https://YOUR_DOMAIN/api/twilio/inbound`
- Status callbacks: `https://YOUR_DOMAIN/api/twilio/status`

Both endpoints accept `POST` only and verify Twilio's signature before any
database write. The status callback URL is added automatically to every new
outbound message.

## 4. Configure Lodgify booking webhooks

As an owner or administrator, open **New Bookings** in GuestOpsHQ and choose
**Enable automatic updates**. The app subscribes Lodgify's
`booking_new_status_booked` event to:

`https://YOUR_DOMAIN/api/lodgify/webhook`

The signing secret returned by Lodgify is stored only in GuestOpsHQ's
server-side integration record; it is not exposed to the browser. A
`LODGIFY_WEBHOOK_SECRET` Vercel variable is only needed when a webhook was
created manually outside the app. GuestOpsHQ verifies the `ms-signature` HMAC
on every request and creates only the guest, stay, and Inbox record. It never
sends a welcome message.

### A2P campaign review

US long-code SMS cannot be delivered until the linked A2P campaign is approved.
While a campaign is under review, Twilio may return error `30034`. GuestOpsHQ
shows this as a pending-campaign message and does not offer a retry for that
specific condition. Once Twilio approves the campaign, normal sending and
delivery-retry behavior resumes.

## 4. Production smoke check

1. Open `/login` and sign in with a property member account.
2. Confirm `/dashboard` only shows assigned properties.
3. Open a conversation, add an internal note and guest note, then refresh.
4. Send a test reply and confirm it appears in the thread as queued/sent.
5. Send a reply from the test phone and confirm one inbound message appears.
6. Retry a deliberately failed outbound once; verify only one replacement row
   is created.
7. Verify unauthenticated API requests return 401 and `/api/admin` returns 410.
