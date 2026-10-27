# Bump CIS shellRev so browsers drop stale index.html (run before commit when shell/* changed).
# Usage: .\scripts\bump_cis_shell_rev.ps1 [-Suffix "short-label"]
param(
  [string]$Suffix = "deploy"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$shell = Join-Path $repoRoot "shell"
$configPath = Join-Path $shell "config.json"
$indexPath = Join-Path $shell "index.html"

if (-not (Test-Path $configPath)) {
  Write-Error "config.json not found at $configPath"
}

$date = Get-Date -Format "yyyyMMdd"
$rev = "$date-$Suffix"

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.shellRev = $rev
($config | ConvertTo-Json -Depth 20) + "`n" | Set-Content $configPath -Encoding utf8NoBOM

$index = Get-Content $indexPath -Raw
$index = $index -replace '<meta name="cis-shell-rev" content="[^"]*"', "<meta name=`"cis-shell-rev`" content=`"$rev`""
$index = $index -replace 'window\.CIS_BOOT_SHELL_REV = "[^"]*"', "window.CIS_BOOT_SHELL_REV = `"$rev`""
Set-Content $indexPath $index -Encoding utf8NoBOM -NoNewline

Write-Host "shellRev -> $rev"
Write-Host "Updated: config.json, index.html (meta + CIS_BOOT_SHELL_REV)"
Write-Host "Commit shell/* then push and run deploy_on_server.sh on bkweb3."
