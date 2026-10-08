# One-time Zebra LAN setup for Carbo Print Labels (run at the plant on the label PC).
# Right-click PowerShell -> Run as administrator (needed to add printer port).

param(
    [string]$Ip = "192.168.8.73",
    [int]$Port = 9100,
    [string]$PrinterName = "Zebra ZT231 LAN"
)

$ErrorActionPreference = "Stop"
$portName = "Carbo_Zebra_${Ip}_${Port}"

Write-Host ""
Write-Host "=== Carbo Zebra LAN setup ===" -ForegroundColor Cyan
Write-Host "Printer IP: $Ip  Port: $Port"
Write-Host ""

$ping = Test-Connection -ComputerName $Ip -Count 2 -Quiet
if (-not $ping) {
    Write-Host "FAIL: Cannot ping $Ip" -ForegroundColor Red
    Write-Host ""
    Write-Host "On the Zebra: Menu -> Network -> Print Network Configuration"
    Write-Host "Use the IP on that label (update this script if different)."
    Write-Host "Also check: laptop on same Wi-Fi as printer (not guest Wi-Fi)."
    exit 1
}
Write-Host "Ping OK" -ForegroundColor Green

$tcp = Test-NetConnection -ComputerName $Ip -Port $Port -WarningAction SilentlyContinue
if (-not $tcp.TcpTestSucceeded) {
    Write-Host "FAIL: Port $Port is closed (ping works but raw print does not)." -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix ON THE PRINTER (pick one):" -ForegroundColor Yellow
    Write-Host "  A) Browser: http://$Ip  -> Print Server / Communications -> enable TCP port 9100"
    Write-Host "  B) Zebra front panel: Menu -> Network -> Print Server -> ON"
    Write-Host "  C) USB once: install Zebra Setup Utilities -> Configure -> enable Raw TCP 9100"
    Write-Host ""
    Write-Host "Then run this script again."
    exit 1
}
Write-Host "Port $Port OK (raw ZPL ready)" -ForegroundColor Green

if (-not (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue)) {
    Write-Host "Adding Windows TCP/IP port $portName ..."
    Add-PrinterPort -Name $portName -PrinterHostAddress $Ip -PortNumber $Port
} else {
    Write-Host "Port $portName already exists."
}

$driver = Get-PrinterDriver -Name "Generic / Text Only" -ErrorAction SilentlyContinue
if (-not $driver) {
    Write-Host "Installing Generic / Text Only driver ..."
    Add-PrinterDriver -Name "Generic / Text Only"
}

$existing = Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Updating printer '$PrinterName' to use LAN port ..."
    Set-Printer -Name $PrinterName -PortName $portName
} else {
    Write-Host "Creating printer '$PrinterName' ..."
    Add-Printer -DriverName "Generic / Text Only" -PortName $portName -Name $PrinterName
}

Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host "In Carbo Print Labels:"
Write-Host "  1. Refresh printer list"
Write-Host "  2. Small labels (Zebra) -> $PrinterName"
Write-Host "  3. Zebra connection -> Windows printer (recommended)"
Write-Host "  4. Print a 1-label test, then your batch of 100+"
Write-Host ""
