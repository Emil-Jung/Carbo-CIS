function Get-CisServerSshTarget {
    if ($env:CIS_SERVER_SSH) { return $env:CIS_SERVER_SSH.Trim() }
    return 'bkweb3dev@192.168.89.101'
}

function Get-CisServerUploadDir {
    if ($env:CIS_SERVER_UPLOAD_DIR) { return $env:CIS_SERVER_UPLOAD_DIR.Trim() }
    return 'cis_app_upload'
}

function Get-CisServerWebDir {
    if ($env:CIS_SERVER_WEB_DIR) { return $env:CIS_SERVER_WEB_DIR.TrimEnd('/') }
    return '/opt/carbo/cis/app'
}

function Get-CisRepoRoot {
    return Split-Path -Parent $PSScriptRoot
}

function Get-CisDownloadDir {
    param([string]$Root)
    if (-not $Root) {
        $Root = Get-CisRepoRoot
    }
    return Join-Path $Root 'desktop\cis_download'
}

function Get-CisDownloadBaseUrl {
    if ($env:CIS_DOWNLOAD_BASE_URL) { return $env:CIS_DOWNLOAD_BASE_URL.TrimEnd('/') }
    return 'https://bkweb3.bigk.co.uk/cis/app'
}
