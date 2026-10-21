# Desktop shortcut to Carbo Print Labels (.exe) - label printing only, not full CIS.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$localApp = [Environment]::GetFolderPath("LocalApplicationData")
$installExe = Join-Path $localApp "Programs\Carbo CIS\Print Labels\Carbo Print Labels.exe"
$distExe = Join-Path $PSScriptRoot "dist\Carbo Print Labels\Carbo Print Labels.exe"

$target = $null
if ((Test-Path -LiteralPath $installExe) -and (Test-Path -LiteralPath $distExe)) {
    $installTime = (Get-Item -LiteralPath $installExe).LastWriteTime
    $distTime = (Get-Item -LiteralPath $distExe).LastWriteTime
    if ($distTime -gt $installTime) {
        [System.Windows.Forms.MessageBox]::Show(
            "Your latest build is in desktop\dist\ but Start menu shortcuts open the installed copy.`n`n" +
            "  Installed: $installExe`n    $($installTime.ToString('yyyy-MM-dd HH:mm'))`n`n" +
            "  Dev build: $distExe`n    $($distTime.ToString('yyyy-MM-dd HH:mm'))`n`n" +
            "Run SYNC-PRINT-LABELS-TO-INSTALL.cmd (or CarboPrintLabels-Setup.exe), then use the shortcut again.",
            "Carbo Print Labels — install is older than dist",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
    }
}
foreach ($path in @($installExe, $distExe)) {
    if (Test-Path -LiteralPath $path) {
        $target = $path
        break
    }
}

if (-not $target) {
    [System.Windows.Forms.MessageBox]::Show(
        "Carbo Print Labels is not installed.`n`nInstall:`n" +
        "https://bkweb3.bigk.co.uk/cis/app/CarboPrintLabels-Setup.exe`n`n" +
        "Or run the full CIS installer (includes Print Labels).",
        "Carbo Print Labels",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
}

$workDir = Split-Path $target -Parent
$iconPath = Join-Path $workDir "print_labels.ico"
if (-not (Test-Path -LiteralPath $iconPath)) {
    $repoIco = Join-Path $PSScriptRoot "assets\print_labels.ico"
    if (Test-Path -LiteralPath $repoIco) {
        Copy-Item -LiteralPath $repoIco -Destination $iconPath -Force
    }
}
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Carbo Print Labels.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $workDir
$shortcut.WindowStyle = 1
$shortcut.Description = "Carbo Print Labels (Zebra and A4 only)"
if (Test-Path -LiteralPath $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
} else {
    $shortcut.IconLocation = "$target,0"
}
$shortcut.Save()

& (Join-Path $PSScriptRoot "Apply-Print-Labels-Shortcut-Icons.ps1") 2>$null

[System.Windows.Forms.MessageBox]::Show(
    "Desktop shortcut created:`n$lnkPath`n`nOpens:`n$target",
    "Carbo Print Labels",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
