# Stage the built CIS .exe for release: compute SHA256 and write version.json.
# Run AFTER BUILD-CIS.cmd. Output goes to desktop\cis_download\ ready to upload.
$ErrorActionPreference = 'Stop'

$desktopDir = Split-Path -Parent $PSScriptRoot
$distExe = Join-Path $desktopDir 'dist\Carbo Integrated System.exe'
$outDir = Join-Path $desktopDir 'cis_download'
$versionPy = Join-Path $desktopDir 'version.py'

if (-not (Test-Path -LiteralPath $distExe)) {
    throw "Build not found: $distExe  (run BUILD-CIS.cmd first)"
}

# Read X.Y.Z from version.py
function Get-Part([string]$name) {
    $line = Select-String -Path $versionPy -Pattern "^\s*$name\s*=\s*(\d+)" | Select-Object -First 1
    if (-not $line) { throw "Could not read $name from version.py" }
    return [int]$line.Matches[0].Groups[1].Value
}
$version = "{0}.{1}.{2}" -f (Get-Part 'CIS_MAJOR'), (Get-Part 'CIS_MODULE'), (Get-Part 'CIS_INTERNAL')

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$exeName = 'Carbo Integrated System.exe'
Copy-Item -LiteralPath $distExe -Destination (Join-Path $outDir $exeName) -Force

$sha = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $outDir $exeName)).Hash.ToLowerInvariant()
$manifest = [ordered]@{
    version  = $version
    exe      = $exeName
    sha256   = $sha
    released = (Get-Date -Format 'yyyy-MM-dd')
}
$manifest | ConvertTo-Json | Set-Content -Path (Join-Path $outDir 'version.json') -Encoding ascii

Write-Host "Staged CIS v$version"
Write-Host "  $outDir\$exeName"
Write-Host "  $outDir\version.json  (sha256 $sha)"
Write-Host ""
Write-Host "Upload both files to the server folder that serves $($env:CIS_DOWNLOAD_BASE_URL) (default: /opt/carbo/cis/app/)."
