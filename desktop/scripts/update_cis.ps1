# Detached updater for Carbo Integrated System (installer model).
# Started by the running app before it exits: downloads the installer, verifies its
# SHA256, runs it silently (per-user, no UAC), then relaunches the app.
param(
    [Parameter(Mandatory = $true)]
    [string]$ParamsFile
)

$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    if ($script:LogPath) {
        Add-Content -Path $script:LogPath -Value $line -Encoding ascii
    }
}

if (-not (Test-Path -LiteralPath $ParamsFile)) {
    throw "Params file not found: $ParamsFile"
}

$params = Get-Content -LiteralPath $ParamsFile -Raw -Encoding UTF8 | ConvertFrom-Json
$workDir = [string]$params.work_dir
$appExe = [string]$params.app_exe
$baseUrl = ([string]$params.base_url).TrimEnd('/')
$setupName = [string]$params.setup_name
$remoteVersion = [string]$params.remote_version
$expectedSha = ([string]$params.sha256).ToLowerInvariant()
$parentPid = [int]$params.parent_pid
$sslVerify = $true
if ($null -ne $params.ssl_verify) { $sslVerify = [bool]$params.ssl_verify }
$trustFlag = [string]$params.trust_flag

$script:LogPath = Join-Path $workDir 'update.log'
New-Item -ItemType Directory -Force -Path $workDir | Out-Null

Write-Log "Updater started -> v$remoteVersion ($setupName)"

if ((Test-Path -LiteralPath $trustFlag) -or -not $sslVerify) {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    Write-Log "TLS verification disabled (internal certificate mode)."
}

# Wait for the running app to exit (installer can't overwrite files in use).
if ($parentPid -gt 0) {
    Write-Log "Waiting for app process $parentPid to exit..."
    $waited = 0
    while ($waited -lt 120) {
        if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 1
        $waited++
    }
}

$setupPath = Join-Path $workDir $setupName
$setupUri = "$baseUrl/$([uri]::EscapeDataString($setupName))"

Write-Log "Downloading $setupUri"
Invoke-WebRequest -Uri $setupUri -OutFile $setupPath -UseBasicParsing

if ($expectedSha) {
    $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $setupPath).Hash.ToLowerInvariant()
    if ($hash -ne $expectedSha) {
        Remove-Item -LiteralPath $setupPath -Force -ErrorAction SilentlyContinue
        throw "SHA256 mismatch. Expected $expectedSha got $hash"
    }
    Write-Log "SHA256 verified."
}

Write-Log "Running installer silently..."
# Inno Setup silent switches; per-user install so no UAC prompt.
$proc = Start-Process -FilePath $setupPath `
    -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOCANCEL' `
    -Wait -PassThru
Write-Log "Installer exit code: $($proc.ExitCode)"

if (Test-Path -LiteralPath $appExe) {
    Write-Log "Launching updated app..."
    Start-Process -FilePath $appExe
} else {
    Write-Log "WARNING: app exe not found at $appExe after install."
}
Write-Log "Done."
