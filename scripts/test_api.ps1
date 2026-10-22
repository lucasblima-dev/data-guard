# ==============================================================================
# DataGuard - Script de Testes Automatizados (Módulo 1)
# ==============================================================================
# Uso:
#   .\scripts\test_api.ps1
#   .\scripts\test_api.ps1 -BaseUrl "https://minha-api.onrender.com"
# ==============================================================================

param (
    [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "DataGuard - Iniciando Teste da API em: $BaseUrl" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Healthcheck
Write-Host "`n[1/6] Testando Healthcheck (GET /health)..." -ForegroundColor Yellow
$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
Write-Host "Resposta: $($health | ConvertTo-Json -Compress)" -ForegroundColor Green

# 2. Criar Job (POST /api/analyses)
Write-Host "`n[2/6] Criando nova analise (POST /api/analyses)..." -ForegroundColor Yellow
$createBody = @{
    original_filename = "vendas_teste_powershell.csv"
    file_size_bytes   = 1048576
    file_ref          = "/storage/vendas_teste_powershell.csv"
} | ConvertTo-Json

$createdJob = Invoke-RestMethod -Uri "$BaseUrl/api/analyses" -Method Post -Body $createBody -ContentType "application/json"
$jobId = $createdJob.id
Write-Host "Job Criado com Sucesso! ID: $jobId" -ForegroundColor Green
Write-Host "Resposta: $($createdJob | ConvertTo-Json -Compress)" -ForegroundColor Green

# 3. Consultar Job por ID (GET /api/analyses/{id})
Write-Host "`n[3/6] Consultando analise criada por ID (GET /api/analyses/$jobId)..." -ForegroundColor Yellow
$fetchedJob = Invoke-RestMethod -Uri "$BaseUrl/api/analyses/$jobId" -Method Get
Write-Host "Job Recuperado: status = $($fetchedJob.status), filename = $($fetchedJob.original_filename)" -ForegroundColor Green

# 4. Listar Jobs Paginados (GET /api/analyses)
Write-Host "`n[4/6] Listando analises com paginacao (GET /api/analyses?page=1&page_size=5)..." -ForegroundColor Yellow
$listResult = Invoke-RestMethod -Uri "$BaseUrl/api/analyses?page=1&page_size=5" -Method Get
Write-Host "Total de itens no banco: $($listResult.total) | Pagina atual: $($listResult.page)/$($listResult.total_pages)" -ForegroundColor Green

# 5. Atualizar Status do Job (PATCH /api/analyses/{id})
Write-Host "`n[5/6] Atualizando status da analise para 'concluida' (PATCH /api/analyses/$jobId)..." -ForegroundColor Yellow
$patchBody = @{
    status = "concluida"
} | ConvertTo-Json

$updatedJob = Invoke-RestMethod -Uri "$BaseUrl/api/analyses/$jobId" -Method Patch -Body $patchBody -ContentType "application/json"
Write-Host "Status Atualizado: $($updatedJob.status)" -ForegroundColor Green

# 6. Excluir Job (DELETE /api/analyses/{id})
Write-Host "`n[6/6] Excluindo analise de teste (DELETE /api/analyses/$jobId)..." -ForegroundColor Yellow
$deleteResponse = Invoke-WebRequest -Uri "$BaseUrl/api/analyses/$jobId" -Method Delete
Write-Host "Status HTTP da Delecao: $($deleteResponse.StatusCode) (No Content)" -ForegroundColor Green

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "Sucesso: Todos os testes do CRUD foram concluidos com exito!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
