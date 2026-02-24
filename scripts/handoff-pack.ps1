$ErrorActionPreference = "Stop"

Write-Host "=== GuestOpsHQ HANDOFF PACK ==="

Write-Host "`n## Repo root"
Get-Location | Out-String | Write-Host

Write-Host "`n## Key paths existence"
"app/dashboard/page.tsx","app/dashboard/InboxClient.tsx","src/app/api/me/memberships/route.ts","app/api/conversations/route.ts","src/lib/api/requireApiAuth.ts","src/lib/supabase/getSupabaseRlsServerClient.ts" |
  ForEach-Object {
    "{0} => {1}" -f $_, (Test-Path $_)
  } | Write-Host

Write-Host "`n## API routes (app/api + src/app/api)"
if (Test-Path ".\app\api") { Get-ChildItem ".\app\api" -Recurse -File | Select-Object FullName }
if (Test-Path ".\src\app\api") { Get-ChildItem ".\src\app\api" -Recurse -File | Select-Object FullName }

Write-Host "`n## Grep: conversations endpoint + memberships endpoint"
Select-String -Path ".\app\**\*.ts",".\app\**\*.tsx",".\src\**\*.ts",".\src\**\*.tsx" -SimpleMatch -Pattern "/api/conversations","my_property_memberships","requireApiAuth","getSupabaseRlsServerClient" |
  Select-Object Path, LineNumber, Line | Format-Table -AutoSize

Write-Host "`n## Done"