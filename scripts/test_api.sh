#!/usr/bin/env bash
# ==============================================================================
# DataGuard - Script de Testes Automatizados via cURL (Módulo 1)
# ==============================================================================
#
# Uso:
#   ./scripts/test_api.sh                                (executa contra localhost:8000)
#   ./scripts/test_api.sh https://minha-api.onrender.com (executa contra URL pública)
# ==============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"

echo "======================================================================"
echo "DataGuard - Iniciando Teste da API em: ${BASE_URL}"
echo "======================================================================"

# 1. Healthcheck
echo -e "\n[1/6] Testando Healthcheck (GET /health)..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/health")
BODY=$(echo "${HEALTH_RESPONSE}" | sed -e '$d')
STATUS=$(echo "${HEALTH_RESPONSE}" | tail -n1 | cut -d':' -f2)

echo "Status: ${STATUS}"
echo "Corpo: ${BODY}"
if [ "${STATUS}" -ne 200 ]; then
  echo "ERRO: Healthcheck falhou com status ${STATUS}!"
  exit 1
fi

# 2. Criar Job (POST /api/analyses)
echo -e "\n[2/6] Criando nova analise (POST /api/analyses)..."
CREATE_PAYLOAD='{"original_filename": "vendas_teste_2026.csv", "file_size_bytes": 2048576, "file_ref": "/storage/vendas_teste_2026.csv"}'
CREATE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/api/analyses" \
  -H "Content-Type: application/json" \
  -d "${CREATE_PAYLOAD}")

CREATE_BODY=$(echo "${CREATE_RESPONSE}" | sed -e '$d')
CREATE_STATUS=$(echo "${CREATE_RESPONSE}" | tail -n1 | cut -d':' -f2)

echo "Status: ${CREATE_STATUS}"
echo "Corpo: ${CREATE_BODY}"

if [ "${CREATE_STATUS}" -ne 201 ]; then
  echo "ERRO: Criacao do job falhou com status ${CREATE_STATUS}!"
  exit 1
fi

# Extrai o job_id do JSON retornado
JOB_ID=$(echo "${CREATE_BODY}" | grep -o '"id":"[^"]*' | cut -d'"' -f4 || true)
if [ -z "${JOB_ID}" ]; then
  # Fallback caso grep nao encontre com regex simples
  JOB_ID=$(echo "${CREATE_BODY}" | python -c "import sys, json; print(json.load(sys.stdin)['id'])")
fi
echo "ID da analise criada: ${JOB_ID}"

# 3. Consultar Job por ID (GET /api/analyses/{id})
echo -e "\n[3/6] Consultando analise criada por ID (GET /api/analyses/${JOB_ID})..."
GET_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/api/analyses/${JOB_ID}")
GET_BODY=$(echo "${GET_RESPONSE}" | sed -e '$d')
GET_STATUS=$(echo "${GET_RESPONSE}" | tail -n1 | cut -d':' -f2)

echo "Status: ${GET_STATUS}"
echo "Corpo: ${GET_BODY}"
if [ "${GET_STATUS}" -ne 200 ]; then
  echo "ERRO: Consulta por ID falhou com status ${GET_STATUS}!"
  exit 1
fi

# 4. Listar Jobs Paginados (GET /api/analyses)
echo -e "\n[4/6] Listando analises com paginacao (GET /api/analyses?page=1&page_size=5)..."
LIST_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/api/analyses?page=1&page_size=5")
LIST_BODY=$(echo "${LIST_RESPONSE}" | sed -e '$d')
LIST_STATUS=$(echo "${LIST_RESPONSE}" | tail -n1 | cut -d':' -f2)

echo "Status: ${LIST_STATUS}"
echo "Corpo: ${LIST_BODY}"
if [ "${LIST_STATUS}" -ne 200 ]; then
  echo "ERRO: Listagem falhou com status ${LIST_STATUS}!"
  exit 1
fi

# 5. Atualizar Status do Job (PATCH /api/analyses/{id})
echo -e "\n[5/6] Atualizando status da analise para 'concluida' (PATCH /api/analyses/${JOB_ID})..."
PATCH_PAYLOAD='{"status": "concluida"}'
PATCH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PATCH "${BASE_URL}/api/analyses/${JOB_ID}" \
  -H "Content-Type: application/json" \
  -d "${PATCH_PAYLOAD}")

PATCH_BODY=$(echo "${PATCH_RESPONSE}" | sed -e '$d')
PATCH_STATUS=$(echo "${PATCH_RESPONSE}" | tail -n1 | cut -d':' -f2)

echo "Status: ${PATCH_STATUS}"
echo "Corpo: ${PATCH_BODY}"
if [ "${PATCH_STATUS}" -ne 200 ]; then
  echo "ERRO: Atualizacao falhou com status ${PATCH_STATUS}!"
  exit 1
fi

# 6. Excluir Job (DELETE /api/analyses/{id})
echo -e "\n[6/6] Excluindo analise de teste (DELETE /api/analyses/${JOB_ID})..."
DELETE_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "${BASE_URL}/api/analyses/${JOB_ID}")
DELETE_STATUS=$(echo "${DELETE_RESPONSE}" | tail -n1 | cut -d':' -f2)

echo "Status: ${DELETE_STATUS}"
if [ "${DELETE_STATUS}" -ne 204 ]; then
  echo "ERRO: Delecao falhou com status ${DELETE_STATUS}!"
  exit 1
fi

echo -e "\n======================================================================"
echo "Sucesso: Todos os testes do CRUD foram concluidos com exito!"
echo "======================================================================"
