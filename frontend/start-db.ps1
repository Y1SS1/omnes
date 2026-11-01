# Starts the local PostgreSQL cluster used by TaskFlow (data in .pgdata, port 5433).
# This is a standalone cluster created for this project - it is NOT the Windows
# "postgresql-x64-16" service, so it needs to be started manually each session.

$pgCtl = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"
$dataDir = Join-Path $PSScriptRoot ".pgdata"

if (-not (Test-Path $dataDir)) {
    Write-Host "No se encontró $dataDir. ¿Se movió o eliminó la carpeta .pgdata?" -ForegroundColor Red
    exit 1
}

& $pgCtl -D $dataDir -l "$dataDir\log.txt" status
if ($LASTEXITCODE -eq 0) {
    Write-Host "PostgreSQL ya está corriendo en el puerto 5433." -ForegroundColor Green
} else {
    & $pgCtl -D $dataDir -l "$dataDir\log.txt" start
    Write-Host "PostgreSQL iniciado en el puerto 5433." -ForegroundColor Green
}
