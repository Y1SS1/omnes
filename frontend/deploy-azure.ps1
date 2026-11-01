# Rebuilds the frontend, copies it into the backend's wwwroot, publishes the
# backend, and deploys the whole thing (one app, one URL) to Azure App Service.
# Usage: .\deploy-azure.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$python = "C:\Users\victo\AppData\Local\Python\bin\python.exe"

Write-Host "1/4 Building frontend..." -ForegroundColor Cyan
Set-Location "$root\frontend"
$env:VITE_API_URL = "/api"
npm run build

Write-Host "2/4 Copying frontend into backend/wwwroot..." -ForegroundColor Cyan
$wwwroot = "$root\backend\TaskFlow.Api\wwwroot"
if (Test-Path $wwwroot) { Remove-Item $wwwroot -Recurse -Force }
New-Item -ItemType Directory -Path $wwwroot | Out-Null
Copy-Item "$root\frontend\dist\*" $wwwroot -Recurse

Write-Host "3/4 Publishing backend..." -ForegroundColor Cyan
Set-Location "$root\backend\TaskFlow.Api"
if (Test-Path .\publish) { Remove-Item .\publish -Recurse -Force }
dotnet publish -c Release -o .\publish

Write-Host "4/4 Zipping (forward-slash paths, required on Linux App Service) and deploying..." -ForegroundColor Cyan
if (Test-Path .\omnes-api.zip) { Remove-Item .\omnes-api.zip -Force }
& $python -c "
import zipfile, os
with zipfile.ZipFile('omnes-api.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('publish'):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, 'publish').replace(os.sep, '/')
            zf.write(full, rel)
"

az webapp deploy --resource-group rg-omnes --name omnes-api-vyissim --src-path .\omnes-api.zip --type zip

Write-Host "Listo: https://omnes-api-vyissim.azurewebsites.net" -ForegroundColor Green
Set-Location $root
