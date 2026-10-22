# Point desktop + Start menu Print Labels shortcuts at print_labels.ico (not generic .exe icon).
$ErrorActionPreference = "Stop"

function Ensure-PrintLabelsIcon([string]$WorkDir) {
    $ico = Join-Path $WorkDir "print_labels.ico"
    if (Test-Path -LiteralPath $ico) { return $ico }
    $src = Join-Path $PSScriptRoot "assets\print_labels.ico"
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination $ico -Force
        return $ico
    }
    return $null
}

function Set-ShortcutIcon([string]$LnkPath, [string]$TargetExe, [string]$IconPath) {
    if (-not (Test-Path -LiteralPath $LnkPath)) { return $false }
    $workDir = Split-Path $TargetExe -Parent
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($LnkPath)
    $shortcut.TargetPath = $TargetExe
    $shortcut.WorkingDirectory = $workDir
    if ($IconPath) {
        $shortcut.IconLocation = "$IconPath,0"
    }
    $shortcut.Save()
    return $true
}

$localApp = [Environment]::GetFolderPath("LocalApplicationData")
$installExe = Join-Path $localApp "Programs\Carbo CIS\Print Labels\Carbo Print Labels.exe"
if (-not (Test-Path -LiteralPath $installExe)) {
    Write-Error "Print Labels is not installed: $installExe"
}

$workDir = Split-Path $installExe -Parent
$icon = Ensure-PrintLabelsIcon $workDir
if (-not $icon) {
    Write-Error "Missing print_labels.ico in repo and install folder."
}

$desktop = [Environment]::GetFolderPath("Desktop")
$desktopLnk = Join-Path $desktop "Carbo Print Labels.lnk"
if (-not (Test-Path -LiteralPath $desktopLnk)) {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($desktopLnk)
    $shortcut.TargetPath = $installExe
    $shortcut.WorkingDirectory = $workDir
    $shortcut.Description = "Carbo Print Labels (Zebra and A4 only)"
    $shortcut.IconLocation = "$icon,0"
    $shortcut.Save()
    Write-Host "Created missing desktop shortcut: $desktopLnk"
}

$updated = @()
$paths = @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Carbo Print Labels.lnk"),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Carbo Print Labels.lnk")
)
foreach ($lnk in $paths) {
    if (Set-ShortcutIcon -LnkPath $lnk -TargetExe $installExe -IconPath $icon) {
        $updated += $lnk
    }
}

Write-Host "Icon file: $icon"
foreach ($u in $updated) { Write-Host "Updated: $u" }
if ($updated.Count -eq 0) {
    Write-Host "No shortcuts found - run Create-Print-Labels-Desktop-Shortcut.ps1 first."
}
