\# GuestOpsHQ Handoff System (How this works)



This repo contains a stable “handoff system” so new ChatGPT chats don’t lose context.



\## Canonical Handoff URL

The protected handoff page is:

\- /ops/handoff?k=HANDOFF\_VIEW\_KEY



It renders the latest versions of:

\- docs/PRODUCT\_BRIEF.md

\- docs/PRODUCT\_VISION.md

\- docs/TECH\_HANDOFF.md

\- docs/M1\_SMOKE\_TESTS.md

\- docs/STRUCTURE.md (generated)

\- docs/CODE\_INDEX.md (generated)

\- HANDOFF\_PACK.txt (optional generated)



\## How to update / regenerate

Run these scripts locally from repo root:



\### 1) Generate folder structure

powershell:

\- .\\scripts\\gen-structure.ps1



Outputs:

\- docs/STRUCTURE.md



\### 2) Generate code index snapshot

powershell:

\- .\\scripts\\gen-code-index.ps1



Outputs:

\- docs/CODE\_INDEX.md



\## Required commit flow (always)

After generating:

\- git add .

\- git commit -m "Update handoff"

\- git push



\## When starting a new ChatGPT chat

Paste:

1\) The handoff URL

2\) Current milestone + what you want to do next



Workflow rules for assistant:

\- Always provide FULL file replacements

\- Provide PowerShell commit command: git add .; git commit -m "msg"; git push

\- RLS is source of truth; no service-role for user-facing queries

\- If something breaks: read real API response body before guessing



\## Security notes

\- HANDOFF\_VIEW\_KEY must be set in Vercel env vars (Production).

\- Do not expose the key publicly.

\- Do not store secrets in docs files.

