# DataGuard - Inicializador Local dos 3 Microsserviços
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " INICIANDO MICROSSERVIÇOS DATAGUARD (MODULO 2)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$root = Get-Location

# 1. Data Quality Service (8001)
Write-Host "[1/3] Subindo Data Quality Service na porta 8001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root/services/data-quality-service'; & '$root/.venv/Scripts/uvicorn.exe' app.main:app --host 127.0.0.1 --port 8001 --reload"

# 2. Intelligence Service (8002)
Write-Host "[2/3] Subindo Intelligence Service na porta 8002..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root/services/intelligence-service'; & '$root/.venv/Scripts/uvicorn.exe' app.main:app --host 127.0.0.1 --port 8002 --reload"

# 3. Analysis Service (8000)
Write-Host "[3/3] Subindo Analysis Service (Orquestrador) na porta 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root/services/analysis-service'; & '$root/.venv/Scripts/uvicorn.exe' app.main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host "`nTodos os 3 serviços foram iniciados em terminais dedicados!" -ForegroundColor Green
Write-Host "Para rodar o frontend: cd frontend; npm run dev" -ForegroundColor Cyan
