# Levanta todo el stack de desarrollo local con un solo comando:
# PostgreSQL + backend (.NET) + frontend (Vite), cada uno en su propia ventana.
# Usage: .\dev.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "1/3 Iniciando PostgreSQL..." -ForegroundColor Cyan
& "$root\start-db.ps1"

Write-Host "2/3 Abriendo el backend en una ventana nueva..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend\TaskFlow.Api'; dotnet run"

Write-Host "3/3 Abriendo el frontend en una ventana nueva..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "Listo. Dale unos segundos al backend y al frontend para terminar de arrancar." -ForegroundColor Green
Write-Host "Luego abre: http://localhost:5173" -ForegroundColor Green

Start-Sleep -Seconds 6
Start-Process "http://localhost:5173"
