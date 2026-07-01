# Upload staged CIS app files (CarboCIS-Setup.exe + version.json) to Big-K.
# Run after: BUILD-INSTALLER.cmd + scripts\stage-cis-download.ps1
# VPN must be on.

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\cis-server-paths.ps1"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$localDir = Get-CisDownloadDir -Root $repoRoot
$ssh = Get-CisServerSshTarget
$uploadFolder = Get-CisServerUploadDir
$webDir = Get-CisServerWebDir

$setup = Join-Path $localDir 'CarboCIS-Setup.exe'
$manifest = Join-Path $localDir 'version.json'

if (-not (Test-Path -LiteralPath $setup)) {
    throw "Not found: $setup`nRun BUILD-INSTALLER.cmd and stage-cis-download.ps1 first."
}
if (-not (Test-Path -LiteralPath $manifest)) {
    throw "Not found: $manifest"
}

Write-Host "Uploading CIS app to $ssh ..."
Write-Host "  Local:  $localDir"
Write-Host "  Remote: ~/$uploadFolder/  (then sudo cp to $webDir)"
Write-Host ""

ssh $ssh "mkdir -p $uploadFolder"
scp "$localDir\CarboCIS-Setup.exe" "${ssh}:${uploadFolder}/"
scp "$localDir\version.json" "${ssh}:${uploadFolder}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "SCP failed - check VPN and password."
    exit 1
}

Write-Host ""
Write-Host "Upload OK. On the server run:"
Write-Host "  sudo cp ~/$uploadFolder/* $webDir/"
Write-Host "  curl -s $(Get-CisDownloadBaseUrl)/version.json"
Write-Host ""
