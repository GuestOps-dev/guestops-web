$ErrorActionPreference = "Stop"

function Read-TextSafe([string]$path, [int]$maxLines = 120) {
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
$lines += "## Critical Endpoint Snapshots (first 120 lines)"
$lines += ""

$critical = @(
  "app/api/conversations/route.ts",
  "src/app/api/me/memberships/route.ts"
)

foreach ($f in $critical) {
  $lines += "----- " + $f + " -----"
  $lines += Read-TextSafe $f 120
  $lines += ""
}

$lines += "========================================"
$lines += "## Auth / Supabase Helpers (existence check)"
$lines += ""

$helpers = @(
  "src/lib/api/requireApiAuth.ts",
  "src/lib/supabase/getSupabaseRlsServerClient.ts",
  "src/lib/supabaseApiAuth.ts",
  "src/lib/supabaseServer.ts",
  "src/lib/supabaseBrowser.ts"
)

foreach ($h in $helpers) {
  $lines += $h + " => " + (Test-Path $h)
}

$lines += ""
$lines += "========================================"
$lines += "End of Code Index"

New-Item -ItemType Directory -Force -Path ".\docs" | Out-Null
($lines -join "`n") | Out-File -FilePath ".\docs\CODE_INDEX.md" -Encoding utf8

Write-Host "Wrote .\docs\CODE_INDEX.md"