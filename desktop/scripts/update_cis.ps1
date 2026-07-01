# Detached updater for Carbo Integrated System.
# Started by the running app before it exits; replaces the .exe and relaunches.
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
$installDir = [string]$params.install_dir
$exeName = [string]$params.exe_name
$remoteExe = [string]$params.remote_exe
$baseUrl = ([string]$params.base_url).TrimEnd('/')
$remoteVersion = [string]$params.remote_version
$expectedSha = ([string]$params.sha256).ToLowerInvariant()
$parentPid = [int]$params.parent_pid
$sslVerify = $true
if ($null -ne $params.ssl_verify) {
    $sslVerify = [bool]$params.ssl_verify
}
$trustFlag = [string]$params.trust_flag

$script:LogPath = Join-Path $installDir 'update.log'
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Log "Updater started for $exeName -> v$remoteVersion"

if ((Test-Path -LiteralPath $trustFlag) -or -not $sslVerify) {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    Write-Log "TLS verification disabled (internal certificate mode)."
}

if ($parentPid -gt 0) {
    Write-Log "Waiting for app process $parentPid to exit..."
    $waited = 0
    while ($waited -lt 120) {
        $proc = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
        if (-not $proc) { break }
        Start-Sleep -Seconds 1
        $waited++
    }
    if ($waited -ge 120) {
        Write-Log "Warning: parent process still running after 120s; continuing anyway."
    }
}

$dest = Join-Path $installDir $exeName
$tmp = "$dest.tmp"
$exeUri = "$baseUrl/$([uri]::EscapeDataString($remoteExe))"

Write-Log "Downloading $exeUri"
Invoke-WebRequest -Uri $exeUri -OutFile $tmp -UseBasicParsing

if ($expectedSha) {
  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash.ToLowerInvariant()
  if ($hash -ne $expectedSha) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw "SHA256 mismatch. Expected $expectedSha got $hash"
  }
  Write-Log "SHA256 verified."
}

Move-Item -LiteralPath $tmp -Destination $dest -Force
Write-Log "Installed $dest"

$versionTxt = Join-Path $installDir 'version.txt'
Set-Content -Path $versionTxt -Value $remoteVersion -Encoding ascii

$manifestUri = "$baseUrl/version.json"
Invoke-WebRequest -Uri $manifestUri -OutFile (Join-Path $installDir 'version.json') -UseBasicParsing

Write-Log "Launching updated app..."
Start-Process -FilePath $dest -WorkingDirectory $installDir
Write-Log "Done."
