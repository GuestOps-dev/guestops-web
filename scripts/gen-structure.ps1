$ErrorActionPreference = "Stop"

function Add-Header([string]$text) {
  return @("", "## " + $text, "")
}

function Add-Tree([string]$root, [string[]]$includeGlobs) {
  $out = @()
  if (-not (Test-Path $root)) {
    $out += "_Missing: " + $root + "_"
    return $out
  }

  $rootResolved = (Resolve-Path $root).Path
  $out += "### " + $root
  $out += "---"

  $items = @()
  foreach ($g in $includeGlobs) {
    $items += Get-ChildItem -Path (Join-Path $root $g) -Recurse -Force -ErrorAction SilentlyContinue
  }

  $items = $items | Sort-Object FullName -Unique

  if (-not $items -or $items.Count -eq 0) {
    $out += "no matching files"
    $out += "---"
    $out += ""
    return $out
  }

  foreach ($i in $items) {
    $rel = $i.FullName.Substring($rootResolved.Length).TrimStart("\")
    if ($i.PSIsContainer) {
      $out += "[D] " + $rel
    } else {
      $out += "    " + $rel
    }
  }

  $out += "---"
  $out += ""
  return $out
}

$lines = @()
$lines += "# GuestOpsHQ - Important Folder Structure"
$lines += ""
$lines += "Generated: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$lines += ""
$lines += "This is a CURATED tree (only files that matter for architecture + day-to-day dev)."
$lines += ""

$lines += Add-Header "App (Routes + UI)"
$lines += Add-Tree ".\app" @(
  "layout.tsx",
  "middleware.ts",
  "api\**\*.ts",
  "dashboard\**\*.ts",
  "dashboard\**\*.tsx"
)

$lines += Add-Header "Source (Libraries)"
$lines += Add-Tree ".\src" @(
  "lib\**\*.ts",
  "lib\**\*.tsx",
  "app\api\**\*.ts"
)

$lines += Add-Header "Supabase (Migrations / Policies)"
$lines += Add-Tree ".\supabase" @(
  "**\*.sql",
  "**\*.toml",
  "**\*.json",
  "**\*.ts"
)

$lines += Add-Header "Docs"
$lines += Add-Tree ".\docs" @(
  "**\*.md",
  "**\*.txt"
)

New-Item -ItemType Directory -Force -Path ".\docs" | Out-Null
($lines -join "`n") | Out-File -FilePath ".\docs\STRUCTURE.md" -Encoding utf8

Write-Host "Wrote .\docs\STRUCTURE.md"
