# Upload staged CIS app files (CarboCIS-Setup.exe + version.json) to Big-K.
# Run after: BUILD-INSTALLER.cmd + scripts\stage-cis-download.ps1
# VPN must be on.

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\cis-server-paths.ps1"

$repoRoot = Get-CisRepoRoot
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

$sshOpts = @(
    '-o', 'ConnectTimeout=15'
    '-o', 'ServerAliveInterval=5'
    '-o', 'ServerAliveCountMax=3'
)

function Invoke-Ssh([string]$Remote, [string]$Command) {
    Write-Host ">> ssh $Remote  ($Command)"
    & ssh @sshOpts $Remote $Command
    if ($LASTEXITCODE -ne 0) { throw "SSH failed (exit $LASTEXITCODE). Check VPN and password." }
}

function Invoke-Scp([string]$LocalPath, [string]$RemoteDest) {
    $sizeMb = [math]::Round((Get-Item -LiteralPath $LocalPath).Length / 1MB, 1)
    Write-Host ">> scp $(Split-Path -Leaf $LocalPath) (${sizeMb} MB) -> $RemoteDest"
    Write-Host "   (large file — can take several minutes; not frozen)"
    & scp @sshOpts -O -C $LocalPath $RemoteDest
    if ($LASTEXITCODE -ne 0) { throw "SCP failed (exit $LASTEXITCODE)." }
}

Write-Host "Uploading CIS app to $ssh ..."
Write-Host "  Local:  $localDir"
Write-Host "  Remote: ~/$uploadFolder/  (then sudo cp to $webDir)"
Write-Host ""
Write-Host "If this window never asks for your SSH password, open PowerShell manually and run the scp commands below."
Write-Host ""

Invoke-Ssh $ssh "mkdir -p $uploadFolder"
Invoke-Scp $setup "${ssh}:${uploadFolder}/"
Invoke-Scp $manifest "${ssh}:${uploadFolder}/"
Write-Host ""
Write-Host "Upload OK. On the server run:"
Write-Host "  sudo cp ~/$uploadFolder/* $webDir/"
Write-Host "  Verify in a browser on your PC: $(Get-CisDownloadBaseUrl)/version.json"
Write-Host ""
