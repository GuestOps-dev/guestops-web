# GuestOpsHQ — Next Development Roadmap

---

# Phase 1 — Finish the Messaging CRM (Immediate Next)

Goal: Make the inbox feel like Intercom / Front for vacation rentals.

---

## 1. Guest Profile Panel (Highest Priority)

Location: Right side of conversation view.

Displays:

- Guest Name
- Phone
- Email
- Tags
- Internal Notes
- Past Stays
- Past Conversations

This connects messaging to the Guest CRM.

Example layout:

Guest Profile  
-------------  
John Smith  
+1 267 555 1212  

Tags  
VIP • Late Checkout  

Notes  
"Likes upstairs bedroom"

Past Conversations  
Jan 2026  
Mar 2026  

This will be the next major UX improvement.

---

## 2. Guest Tags

Add structured tags such as:

- VIP
- Repeat Guest
- High Maintenance
- Late Checkout
- Travel Agent
- Influencer

Uses:

- Inbox filtering
- Future automation
- Analytics

Database tables already exist. Only UI needs to be built.

---

## 3. Conversation Status

Currently conversations are effectively just "open".

Add status states:

- Open
- Waiting on Guest
- Waiting on Staff
- Resolved
- Closed

This enables real operational workflows.

---

## 4. Conversation Filters

Inbox filters to add:

- Unassigned
- Assigned to Me
- Open
- Waiting on Guest
- Resolved
- VIP Guests

These become essential once message volume increases.

---

# Phase 2 — Automation Engine

Goal: Reduce manual work.

---

## 5. Auto Responses

Example automation rules:

IF message contains "wifi"  
THEN send quick reply "wifi instructions"

IF message arrives after 10 PM  
THEN auto reply with emergency instructions

IF check-in day  
THEN auto send welcome message

Most of the infrastructure for this already exists.

---

## 6. AI Suggested Replies (ChatGPT)

AI suggests responses but does not auto-send.

Example UI:

Suggested Reply  
---------------  
Hi John — the wifi password is on the fridge.

[Insert] [Edit]

Purpose:

- Dramatically speeds concierge response time
- Keeps staff responses consistent

---

## 7. AI Conversation Summary

Each conversation shows a short summary.

Example:

Guest is arriving tomorrow.  
Requested private chef and airport transfer.

Useful when switching staff between shifts.

---

# Phase 3 — Property Operations Layer

Goal: Turn this into STR operations software, not just messaging.

---

## 8. Task System

Example workflow:

Guest requested towels  
→ Create Task  

Assigned to: Housekeeping  
Due: Today

Tasks can be tied to:

- Property
- Guest
- Stay

---

## 9. Vendor Contacts

Store contacts for operational vendors:

- Chef
- Driver
- Tour operator
- Maintenance
- Housekeeping

Eventually allow messaging directly to vendors.

---

## 10. Stay / Reservation Records

Connect:

- Guest
- Property
- Check-in
- Check-out
- Group size
- Source (Airbnb / direct)

Messaging then links directly to real reservations.

---

# Phase 4 — Owner Intelligence

Goal: Provide insights to property owners.

---

## 11. Reporting Dashboard

Potential metrics:

- Messages per stay
- Response time
- Guest satisfaction
- Common issues

---

## 12. Knowledge Base

Examples:

- WiFi instructions
- Parking instructions
- Check-in instructions
- Local recommendations

Used by:

- Staff
- AI replies
- Automation engine

---

# Phase 5 — Platform Expansion (Later)

This is where GuestOpsHQ becomes a SaaS platform.

---

## 13. Multi-Property Accounts

Allow owners to manage multiple villas.

---

## 14. Team Roles

Role examples:

- Owner
- Operations
- Concierge
- Housekeeping
- Vendor

---

## 15. WhatsApp Integration

Critical for Costa Rica guest communication.

---

## 16. OTA Integration

Eventually support:

- Airbnb
- VRBO
- Booking.com
- Lodgify
- OwnerRez

Do not prioritize this early.

---

# Recommended Development Order

Build in this order:

1. Guest Profile Panel  
2. Guest Tags  
3. Conversation Status  
4. Inbox Filters  
5. AI Suggested Replies  
6. Automation Rules  
7. Task System  
8. Reservation Records  
9. Vendor Contacts  
10. Reporting Dashboard