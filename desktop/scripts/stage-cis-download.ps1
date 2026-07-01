# Stage the built installer for release: compute SHA256 and write version.json.
# Run AFTER BUILD-INSTALLER.cmd. Output goes to desktop\cis_download\ ready to upload.
$ErrorActionPreference = 'Stop'

$desktopDir = Split-Path -Parent $PSScriptRoot
$setup = Join-Path $desktopDir 'installer\Output\CarboCIS-Setup.exe'
$outDir = Join-Path $desktopDir 'cis_download'
$versionPy = Join-Path $desktopDir 'version.py'

if (-not (Test-Path -LiteralPath $setup)) {
    throw "Installer not found: $setup  (run BUILD-CIS.cmd then BUILD-INSTALLER.cmd first)"
}

function Get-Part([string]$name) {
    $line = Select-String -Path $versionPy -Pattern "^\s*$name\s*=\s*(\d+)" | Select-Object -First 1
    if (-not $line) { throw "Could not read $name from version.py" }
    return [int]$line.Matches[0].Groups[1].Value
}
$version = "{0}.{1}.{2}" -f (Get-Part 'CIS_MAJOR'), (Get-Part 'CIS_MODULE'), (Get-Part 'CIS_INTERNAL')

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$setupName = 'CarboCIS-Setup.exe'
Copy-Item -LiteralPath $setup -Destination (Join-Path $outDir $setupName) -Force

$sha = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $outDir $setupName)).Hash.ToLowerInvariant()
$manifest = [ordered]@{
    version  = $version
    setup    = $setupName
    sha256   = $sha
    released = (Get-Date -Format 'yyyy-MM-dd')
}
$manifest | ConvertTo-Json | Set-Content -Path (Join-Path $outDir 'version.json') -Encoding ascii

Write-Host "Staged CIS v$version"
Write-Host "  $outDir\$setupName"
Write-Host "  $outDir\version.json  (sha256 $sha)"
Write-Host ""
Write-Host "Upload both to the server folder serving /cis/app/ (default: /opt/carbo/cis/app/)."
