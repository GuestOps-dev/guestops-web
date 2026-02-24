$ErrorActionPreference = "Stop"

function Read-TextSafe([string]$path, [int]$maxLines = 4000) {
  if (-not (Test-Path $path)) { return "Missing: " + $path }
  $lines = Get-Content $path -ErrorAction SilentlyContinue
  if (-not $lines) { return "" }
  $take = [Math]::Min($lines.Count, $maxLines)
  return ($lines | Select-Object -First $take) -join "`n"
}

function List-Files([string]$root, [string]$pattern) {
  if (-not (Test-Path $root)) { return @() }
  return Get-ChildItem -Path $root -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue |
    Sort-Object FullName |
    ForEach-Object { $_.FullName.Replace((Resolve-Path ".").Path + "\", "") }
}

function Add-FileBlock([ref]$linesRef, [string]$path, [string]$mode) {
  # mode: "full" or "head"
  $lines = $linesRef.Value

  $lines += ""
  $lines += "----- FILE: " + $path + " -----"
  if (-not (Test-Path $path)) {
    $lines += "Missing: " + $path
    $linesRef.Value = $lines
    return
  }

  $max = 200
  if ($mode -eq "full") { $max = 4000 }
  if ($mode -eq "head") { $max = 200 }

  $lines += Read-TextSafe $path $max
  $lines += "----- END FILE: " + $path + " -----"
  $linesRef.Value = $lines
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Git commit (best effort)
$commit = "(unknown)"
try { $commit = (git rev-parse HEAD).Trim() } catch {}

$lines = @()
$lines += "# GuestOpsHQ - Code Index"
$lines += ""
$lines += "Generated: " + $timestamp
$lines += "Commit: " + $commit
$lines += ""
$lines += "NOTE: This is a curated snapshot of important code and routes."
$lines += "Do NOT store secrets here."
$lines += ""
$lines += "========================================"
$lines += ""

$lines += "## Key UI Files"
$lines += "- app/dashboard/page.tsx"
$lines += "- app/dashboard/InboxClient.tsx"
$lines += "- app/dashboard/conversations/[id]/page.tsx"
$lines += ""

$lines += "========================================"
$lines += "## API Routes (App Router)"
$lines += ""

$apiApp = List-Files ".\app\api" "route.ts"
$apiSrc = List-Files ".\src\app\api" "route.ts"

if ($apiApp.Count -gt 0) {
  $lines += "app/api:"
  foreach ($f in $apiApp) { $lines += "- " + $f }
  $lines += ""
}

if ($apiSrc.Count -gt 0) {
  $lines += "src/app/api:"
  foreach ($f in $apiSrc) { $lines += "- " + $f }
  $lines += ""
}

if (($apiApp.Count + $apiSrc.Count) -eq 0) {
  $lines += "No route.ts files found."
  $lines += ""
}

$lines += "========================================"
$lines += "## Critical Files (FULL CONTENT)"
$lines += ""
$lines += "These are included in full to let a new chat patch safely without uploading the repo."
$lines += ""

$criticalFull = @(
  "app/api/conversations/route.ts",
  "app/api/messages/send/route.ts",
  "src/app/api/me/memberships/route.ts",
  "src/lib/api/requireApiAuth.ts",
  "src/lib/supabase/getSupabaseRlsServerClient.ts",
  "src/lib/supabaseServer.ts",
  "src/lib/supabaseBrowser.ts",
  "app/dashboard/page.tsx",
  "app/dashboard/InboxClient.tsx",
  "app/dashboard/conversations/[id]/page.tsx"
)

foreach ($p in $criticalFull) {
  Add-FileBlock ([ref]$lines) $p "full"
}

$lines += ""
$lines += "========================================"
$lines += "## Additional Helpers (HEAD ONLY)"
$lines += ""

$headOnly = @(
  "src/lib/supabaseApiAuth.ts",
  "src/lib/access/getMyMemberships.ts",
  "src/lib/access/fetchMembershipsClient.ts",
  "src/lib/access/validateSelectedProperty.ts"
)

foreach ($p in $headOnly) {
  Add-FileBlock ([ref]$lines) $p "head"
}

$lines += ""
$lines += "========================================"
$lines += "## Env var names referenced (best effort)"
$lines += ""

$lines += "- HANDOFF_VIEW_KEY"
$lines += "- NEXT_PUBLIC_SUPABASE_URL"
$lines += "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
$lines += "- SUPABASE_SERVICE_ROLE_KEY"
$lines += "- TWILIO_ACCOUNT_SID"
$lines += "- TWILIO_AUTH_TOKEN"
$lines += ""

$lines += "========================================"
$lines += "End of Code Index"

New-Item -ItemType Directory -Force -Path ".\docs" | Out-Null
($lines -join "`n") | Out-File -FilePath ".\docs\CODE_INDEX.md" -Encoding utf8

Write-Host "Wrote .\docs\CODE_INDEX.md"