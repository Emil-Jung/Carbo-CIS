# Creates a desktop shortcut to the installed Carbo CIS desktop app (.exe), not the browser URL.
$ErrorActionPreference = "Stop"

$installedExe = Join-Path $env:LOCALAPPDATA "Programs\Carbo CIS\Carbo Integrated System.exe"
$devExe = Join-Path $PSScriptRoot "dist\Carbo Integrated System\Carbo Integrated System.exe"

$target = $null
if (Test-Path -LiteralPath $installedExe) {
    $target = $installedExe
    $workDir = Split-Path $installedExe -Parent
} elseif (Test-Path -LiteralPath $devExe) {
    $target = $devExe
    $workDir = Split-Path $devExe -Parent
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Carbo Integrated System is not installed.`n`nInstall from:`n" +
        "https://bkweb3.bigk.co.uk/cis/app/CarboCIS-Setup.exe`n`n" +
        "Or build with desktop\BUILD-CIS.cmd then BUILD-INSTALLER.cmd.",
        "Carbo CIS",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
}

Add-Type -AssemblyName System.Windows.Forms
$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "Carbo Integrated System.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnkPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $workDir
$shortcut.WindowStyle = 1
$shortcut.Description = "Carbo Integrated System (desktop app — not browser CIS)"
$shortcut.Save()

[System.Windows.Forms.MessageBox]::Show(
    "Desktop shortcut created:`n$lnkPath`n`nOpens:`n$target",
    "Carbo CIS",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
