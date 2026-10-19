# Desktop shortcut to Carbo Print Labels (.exe) - label printing only, not full CIS.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$localApp = [Environment]::GetFolderPath("LocalApplicationData")
$candidates = @(
    (Join-Path $localApp "Programs\Carbo CIS\Print Labels\Carbo Print Labels.exe"),
    (Join-Path $PSScriptRoot "dist\Carbo Print Labels\Carbo Print Labels.exe")
)

$target = $null
foreach ($path in $candidates) {
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
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Carbo Print Labels.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $workDir
$shortcut.WindowStyle = 1
$shortcut.Description = "Carbo Print Labels (Zebra and A4 only)"
$shortcut.Save()

[System.Windows.Forms.MessageBox]::Show(
    "Desktop shortcut created:`n$lnkPath`n`nOpens:`n$target",
    "Carbo Print Labels",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
