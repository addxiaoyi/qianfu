param(
    [string]$HostName = $(if ($env:QF_FTP_HOST) { $env:QF_FTP_HOST } else { "103.236.92.10" }),
    [int]$Port = $(if ($env:QF_FTP_PORT) { [int]$env:QF_FTP_PORT } else { 21 }),
    [string]$User = $env:QF_FTP_USER,
    [string]$Password = $env:QF_FTP_PASSWORD,
    [string]$LocalDir = "qianfu-liandeng/dist",
    [string]$RemoteDir = $(if ($env:QF_FTP_REMOTE_DIR) { $env:QF_FTP_REMOTE_DIR } else { "/www/wwwroot/qianfu-app/qianfu-liandeng/dist" }),
    [switch]$DryRun,
    [switch]$UseSsl,
    [switch]$DisablePassive,
    [switch]$VerifyAfterUpload,
    [string]$VerifyBaseUrl = $(if ($env:QIANFU_BASE_URL) { $env:QIANFU_BASE_URL } else { "https://mc-u.top" }),
    [int]$TimeoutMs = 20000,
    [int]$PreviewLimit = 30
)

$ErrorActionPreference = "Stop"

function Get-RemotePath {
    param([string]$Base, [string]$Child)
    $normalizedBase = $Base.Replace("\", "/").TrimEnd("/")
    $normalizedChild = $Child.Replace("\", "/").TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($normalizedChild)) {
        return $normalizedBase
    }
    return "$normalizedBase/$normalizedChild"
}

function Get-FtpUri {
    param([string]$RemotePath)
    $path = $RemotePath.Replace("\", "/").TrimStart("/")
    $escaped = (($path -split "/") | ForEach-Object { [Uri]::EscapeDataString($_) }) -join "/"
    return "ftp://${HostName}:$Port/$escaped"
}

function Get-LocalRelativePath {
    param([string]$Root, [string]$Path)
    $rootPath = [System.IO.Path]::GetFullPath($Root)
    if (-not $rootPath.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $rootPath = "$rootPath$([System.IO.Path]::DirectorySeparatorChar)"
    }
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    $rootUri = [Uri]::new($rootPath)
    $pathUri = [Uri]::new($pathFull)
    return [Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString()).Replace("\", "/")
}

function New-FtpRequest {
    param([string]$RemotePath, [string]$Method)
    $request = [System.Net.FtpWebRequest]::Create((Get-FtpUri $RemotePath))
    $request.Method = $Method
    $request.Credentials = [System.Net.NetworkCredential]::new($User, $Password)
    $request.EnableSsl = [bool]$UseSsl
    $request.UsePassive = -not [bool]$DisablePassive
    $request.UseBinary = $true
    $request.KeepAlive = $false
    $request.Timeout = $TimeoutMs
    $request.ReadWriteTimeout = $TimeoutMs
    return $request
}

function Ensure-RemoteDirectory {
    param([string]$RemotePath)
    $parts = $RemotePath.Replace("\", "/").Trim("/") -split "/"
    if ($parts.Count -eq 0) {
        return
    }

    $current = ""
    foreach ($part in $parts) {
        if ([string]::IsNullOrWhiteSpace($part)) {
            continue
        }
        $current = "$current/$part"
        try {
            $request = New-FtpRequest $current ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
            $response = $request.GetResponse()
            $response.Close()
        } catch {
            # Existing directories commonly return 550; keep walking.
        }
    }
}

function Upload-File {
    param([string]$LocalPath, [string]$RemotePath)
    $bytes = [System.IO.File]::ReadAllBytes($LocalPath)
    $request = New-FtpRequest $RemotePath ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $request.ContentLength = $bytes.Length
    $stream = $request.GetRequestStream()
    try {
        $stream.Write($bytes, 0, $bytes.Length)
    } finally {
        $stream.Close()
    }
    $response = $request.GetResponse()
    $response.Close()
}

function Invoke-FrontendPublicVerification {
    Write-Host "[verify] Checking remote frontend manifest at $VerifyBaseUrl"
    & node scripts/frontend-dist-manifest.mjs --check-remote $VerifyBaseUrl --kv
    if ($LASTEXITCODE -ne 0) {
        throw "Remote manifest verification failed for $VerifyBaseUrl"
    }

    Write-Host "[verify] Checking remote frontend file sample at $VerifyBaseUrl"
    & node scripts/frontend-dist-manifest.mjs --verify-remote-files $VerifyBaseUrl --max-files 80 --allow-partial --kv
    if ($LASTEXITCODE -ne 0) {
        throw "Remote frontend file sample verification failed for $VerifyBaseUrl"
    }
}

$resolvedLocalDir = Resolve-Path -LiteralPath $LocalDir
$files = Get-ChildItem -LiteralPath $resolvedLocalDir -Recurse -File | Sort-Object FullName

if ($files.Count -eq 0) {
    throw "No files found under $resolvedLocalDir"
}

Write-Host "[ftp-upload] host=$HostName port=$Port remote=$RemoteDir files=$($files.Count) dryRun=$DryRun"

if ($DryRun) {
    $files | Select-Object -First $PreviewLimit | ForEach-Object {
        $relative = Get-LocalRelativePath $resolvedLocalDir $_.FullName
        Write-Host "[dry] $relative -> $(Get-RemotePath $RemoteDir $relative)"
    }
    if ($files.Count -gt $PreviewLimit) {
        Write-Host "[dry] ... $($files.Count - $PreviewLimit) more files"
    }
    if ($VerifyAfterUpload) {
        Write-Host "[dry] would verify remote manifest and file sample at $VerifyBaseUrl"
    }
    exit 0
}

if ([string]::IsNullOrWhiteSpace($User) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw "QF_FTP_USER and QF_FTP_PASSWORD are required unless -DryRun is set."
}

Ensure-RemoteDirectory $RemoteDir

$index = 0
foreach ($file in $files) {
    $index += 1
    $relative = Get-LocalRelativePath $resolvedLocalDir $file.FullName
    $remotePath = Get-RemotePath $RemoteDir $relative
    $remoteParent = Split-Path -Parent $remotePath.Replace("/", "\")
    if ($remoteParent) {
        Ensure-RemoteDirectory $remoteParent.Replace("\", "/")
    }
    Upload-File $file.FullName $remotePath
    Write-Host "[upload] $index/$($files.Count) $relative"
}

if ($VerifyAfterUpload) {
    Invoke-FrontendPublicVerification
}

Write-Host "[done] frontend dist uploaded."
