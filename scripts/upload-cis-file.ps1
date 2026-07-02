param(
    [Parameter(Mandatory = $true)]
    [string]$FileName
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\cis-server-paths.ps1"

$ssh = if ($env:CIS_SERVER_SSH) { $env:CIS_SERVER_SSH.Trim() } else { Get-CisServerSshTarget }
$uploadFolder = if ($env:CIS_SERVER_UPLOAD_DIR) { $env:CIS_SERVER_UPLOAD_DIR.Trim() } else { Get-CisServerUploadDir }
$localDir = Get-CisDownloadDir -Root (Get-CisRepoRoot)
$localPath = Join-Path $localDir $FileName

if (-not (Test-Path -LiteralPath $localPath)) {
    throw "Not found: $localPath"
}

$sshOpts = @(
    '-o', 'ConnectTimeout=15'
    '-o', 'ServerAliveInterval=5'
    '-o', 'ServerAliveCountMax=3'
)

$sizeMb = [math]::Round((Get-Item -LiteralPath $localPath).Length / 1MB, 1)
Write-Host "Uploading $FileName (${sizeMb} MB) to ${ssh}:${uploadFolder}/"
Write-Host "Using legacy scp mode (-O). You should be asked for your SSH password."
Write-Host ""

& ssh @sshOpts $ssh "mkdir -p $uploadFolder"
if ($LASTEXITCODE -ne 0) { throw "SSH mkdir failed (exit $LASTEXITCODE)." }

& scp @sshOpts -O -C $localPath "${ssh}:${uploadFolder}/"
if ($LASTEXITCODE -ne 0) { throw "SCP failed (exit $LASTEXITCODE)." }

Write-Host ""
Write-Host "OK: $FileName uploaded."
Write-Host "On server: sudo cp ~/$uploadFolder/* /opt/carbo/cis/app/"
