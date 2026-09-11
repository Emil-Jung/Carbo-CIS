# Launch CIS desktop without a console window.
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Get-PythonwPath {
    $venv = Join-Path $Root '.venv\Scripts\pythonw.exe'
    if (Test-Path -LiteralPath $venv) { return $venv }

    $py = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($py) {
        $sibling = Join-Path (Split-Path $py.Source -Parent) 'pythonw.exe'
        if (Test-Path -LiteralPath $sibling) { return $sibling }
    }

    $pyw = Get-Command pythonw.exe -ErrorAction SilentlyContinue
    if ($pyw) { return $pyw.Source }

    return $null
}

function Show-LaunchError($text) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $text,
        'Carbo Integrated System',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

$pythonw = Get-PythonwPath
if (-not $pythonw) {
    Show-LaunchError "Could not find pythonw.exe.`n`nFrom desktop\ run:`n  python -m venv .venv`n  .venv\Scripts\pip install -r requirements.txt`n`nOr install Python 3 from python.org."
    exit 1
}

$app = Join-Path $Root 'app.py'
try {
    Start-Process -FilePath $pythonw -ArgumentList @($app) -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
} catch {
    Show-LaunchError ("Failed to start CIS:`n`n" + $_.Exception.Message)
    exit 1
}
