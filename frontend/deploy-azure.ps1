# The deploy needs the backend too, so it only runs from the full repository.
# Usage: .\deploy-azure.ps1

$fullDeploy = Join-Path (Split-Path $PSScriptRoot -Parent) "deploy-azure.ps1"
if (-not (Test-Path $fullDeploy)) {
    throw "Este repositorio solo tiene el frontend. Despliega con deploy-azure.ps1 desde el repositorio completo (Y1SS1/omnes)."
}
& $fullDeploy
