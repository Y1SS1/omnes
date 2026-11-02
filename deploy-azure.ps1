# Rebuilds the frontend, copies it into the backend's wwwroot, publishes the
# backend, and deploys the whole thing (one app, one URL) to Azure App Service.
# Usage: .\deploy-azure.ps1
#
# Check for pending migrations before running it: the app applies them when it
# starts, and a migration can delete production data.

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$frontend = "$root\frontend\frontend"
$api = "$root\backend\TaskFlow.Api"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# npm and az also write ordinary warnings to stderr, which "Stop" would treat as
# errors, so external tools are judged by their exit code instead.
function Invoke-Tool([string]$step, [scriptblock]$command) {
    $ErrorActionPreference = "Continue"
    & $command
    if ($LASTEXITCODE -ne 0) { throw "Fallo: $step" }
}

try {
    Write-Host "1/4 Building frontend..." -ForegroundColor Cyan
    Set-Location $frontend
    $env:VITE_API_URL = "/api"
    Invoke-Tool "compilar el frontend" { npm run build }

    Write-Host "2/4 Copying frontend into backend/wwwroot..." -ForegroundColor Cyan
    $wwwroot = "$api\wwwroot"
    if (Test-Path $wwwroot) { Remove-Item $wwwroot -Recurse -Force }
    New-Item -ItemType Directory -Path $wwwroot | Out-Null
    Copy-Item "$frontend\dist\*" $wwwroot -Recurse

    Write-Host "3/4 Publishing backend..." -ForegroundColor Cyan
    Set-Location $api
    if (Test-Path .\publish) { Remove-Item .\publish -Recurse -Force }
    Invoke-Tool "publicar el backend" { dotnet publish -c Release -o .\publish }

    Write-Host "4/4 Zipping (forward-slash paths, required on Linux App Service) and deploying..." -ForegroundColor Cyan
    $zipPath = "$api\omnes-api.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    $publish = (Resolve-Path .\publish).Path
    $zip = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $publish -Recurse -File | ForEach-Object {
            $entry = $_.FullName.Substring($publish.Length + 1).Replace('\', '/')
            [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry)
        }
    }
    finally {
        $zip.Dispose()
    }

    Invoke-Tool "desplegar en Azure" {
        az webapp deploy --resource-group rg-omnes --name omnes-api-vyissim --src-path $zipPath --type zip
    }

    Write-Host "Listo: https://omnes-api-vyissim.azurewebsites.net" -ForegroundColor Green
}
finally {
    Set-Location $root
}
