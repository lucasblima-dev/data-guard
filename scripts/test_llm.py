"""Script de diagnostico e validacao passo a passo da camada de IA (LLM Hibrido).

Realiza tres verificacoes sequenciais sem exigir bibliotecas externas alem da stdlib do Python:
  1. Healthcheck do intelligence-service (confere LLM_ENABLED, LLM_PROVIDER, modelo e token).
  2. Probe direto no endpoint interno POST /internal/llm/probe (exibe latencia, modo de geracao,
     resumo executivo e insights gerados pelo LLM, ou a causa exata caso caia em fallback).
  3. Teste ponta a ponta opcional (--e2e): faz upload de um CSV com anomalias no analysis-service,
     aguarda o pipeline assincrono concluir e valida o laudo persistido no relatorio final.

Uso:
  python scripts/test_llm.py
  python scripts/test_llm.py --e2e
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any
from uuid import uuid4

SAMPLE_CSV = (
    "id_pedido,email_cliente,valor_venda,desconto\n"
    "101,ana@empresa.com,250.00,10.0\n"
    "102,,180.50,0.0\n"
    "103,,95.00,5.0\n"
    "104,carlos@empresa.com,420.00,15.0\n"
    "105,,310.00,0.0\n"
    "105,,310.00,0.0\n"
    "106,julia@empresa.com,125.00,5.0\n"
    "106,julia@empresa.com,125.00,5.0\n"
)


def http_json(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    timeout: float = 35.0,
) -> tuple[int, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url=url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(raw)
        except Exception:
            return exc.code, {"raw": raw}


def upload_csv(api_base: str, filename: str, content: str, timeout: float = 15.0) -> tuple[int, Any]:
    boundary = f"----DataGuardBoundary{uuid4().hex}"
    body_lines = [
        f"--{boundary}",
        f'Content-Disposition: form-data; name="file"; filename="{filename}"',
        "Content-Type: text/csv",
        "",
        content,
        f"--{boundary}--",
        "",
    ]
    body = "\r\n".join(body_lines).encode("utf-8")
    req = urllib.request.Request(
        url=f"{api_base.rstrip('/')}/analyses",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def print_banner(title: str) -> None:
    print("\n" + "=" * 76)
    print(f" {title}")
    print("=" * 76)


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida a resposta do modelo LLM no DataGuard.")
    parser.add_argument(
        "--intelligence-url",
        default="http://127.0.0.1:8002",
        help="URL base do intelligence-service (padrao: http://127.0.0.1:8002)",
    )
    parser.add_argument(
        "--api-url",
        default="http://localhost:8000/api",
        help="URL base da API publica do analysis-service (padrao: http://localhost:8000/api)",
    )
    parser.add_argument(
        "--e2e",
        action="store_true",
        help="Executa tambem um upload completo no analysis-service e valida o relatorio persistido.",
    )
    args = parser.parse_args()

    # Etapa 1: Healthcheck
    print_banner("ETAPA 1 — Verificando configuracao ativa no intelligence-service")
    try:
        status_code, health = http_json("GET", f"{args.intelligence_url.rstrip('/')}/health", timeout=8.0)
    except Exception as exc:
        print(f"[ERRO] Nao foi possivel conectar em {args.intelligence_url}/health: {exc}")
        print("Dica: verifique se os containers estao rodando com: docker compose ps")
        return 1

    if status_code != 200:
        print(f"[ERRO] Healthcheck retornou HTTP {status_code}: {health}")
        return 1

    print(f"  Servico             : {health.get('service')} (v{health.get('version')})")
    print(f"  LLM_ENABLED         : {health.get('llm_enabled')}")
    print(f"  LLM_PROVIDER        : {health.get('llm_provider')}")
    print(f"  Modelo configurado  : {health.get('llm_model', 'n/d')}")
    print(f"  HF_TOKEN preenchido : {health.get('hf_token_configured', 'n/d')}")

    # Etapa 2: Probe direto no provedor LLM
    print_banner("ETAPA 2 — Testando sintese direta no modelo LLM (/internal/llm/probe)")
    try:
        probe_status, probe = http_json(
            "POST",
            f"{args.intelligence_url.rstrip('/')}/internal/llm/probe",
            payload={},
            timeout=35.0,
        )
    except Exception as exc:
        print(f"[ERRO] Falha ao chamar /internal/llm/probe: {exc}")
        return 1

    if probe_status != 200:
        print(f"[ERRO] Endpoint /internal/llm/probe retornou HTTP {probe_status}: {probe}")
        print("Dica: reconstrua o container caso tenha atualizado o codigo:")
        print("      docker compose up -d --build intelligence-service")
        return 1

    direct_ok = bool(probe.get("direct_provider_ok"))
    gen_mode = probe.get("generation_mode")
    latency = probe.get("latency_ms")
    err_detail = probe.get("error_detail")
    sample = probe.get("sample_report") or {}

    print(f"  Resposta direta IA  : {'SIM (LLM respondeu!)' if direct_ok else 'NAO (caiu em fallback rules_only)'}")
    print(f"  generation_mode     : {gen_mode}")
    print(f"  Latencia            : {latency} ms")

    if err_detail:
        print(f"\n  [MOTIVO DO FALLBACK]: {err_detail}")
        print("\n  Como corrigir:")
        print("    1. Abra o arquivo .env na raiz do projeto.")
        print("    2. Defina LLM_ENABLED=true")
        print("    3. Se usar Hugging Face (sem GPU local):")
        print("         LLM_PROVIDER=huggingface")
        print("         HF_TOKEN=hf_... (token Fine-grained com permissao 'Make calls to Inference Providers')")
        print("       Se usar Ollama (local ou LAN da UERN):")
        print("         LLM_PROVIDER=ollama")
        print("         OLLAMA_BASE_URL=http://host.docker.internal:11434  (ou IP da maquina na LAN)")
        print("    4. Recrie o container para aplicar o .env:")
        print("         docker compose up -d --force-recreate intelligence-service")
    else:
        print("\n  [AMOSTRA GERADA PELO MODELO LLM]:")
        print(f"  Resumo executivo:\n    {sample.get('executive_summary')}\n")
        insights = sample.get("key_insights") or []
        print(f"  Insights contextualizados ({len(insights)}):")
        for idx, item in enumerate(insights, start=1):
            print(f"    {idx}. [{item.get('finding_code')}] {item.get('interpretation')}")
            print(f"       Acao sugerida: {item.get('suggested_action')}")

    if not args.e2e:
        print("\nDica: adicione --e2e para testar tambem o fluxo completo de upload via RabbitMQ/API.")
        return 0 if direct_ok else 2

    # Etapa 3: Upload E2E opcional
    print_banner("ETAPA 3 — Teste ponta a ponta via Analysis Service (Upload CSV -> Relatorio)")
    status_up, created = upload_csv(args.api_url, "teste_llm.csv", SAMPLE_CSV)
    if status_up not in (200, 201, 202):
        print(f"[ERRO] Falha no upload para {args.api_url}/analyses: HTTP {status_up} - {created}")
        return 1

    job_id = created.get("id")
    print(f"  Job criado          : {job_id} (status inicial: {created.get('status')})")

    deadline = time.time() + 45.0
    final_status = created.get("status")
    st_data: dict[str, Any] = created
    while time.time() < deadline:
        _, st_data = http_json("GET", f"{args.api_url.rstrip('/')}/analyses/{job_id}")
        final_status = st_data.get("status")
        if final_status in ("concluida", "falhou"):
            break
        time.sleep(1.0)

    print(f"  Status final do job : {final_status}")
    if final_status != "concluida":
        print(f"[ERRO] A analise nao concluiu com sucesso: {st_data}")
        return 1

    _, full_data = http_json("GET", f"{args.api_url.rstrip('/')}/analyses/{job_id}/report")
    report = full_data.get("report") or {}
    e2e_mode = report.get("generation_mode")
    print(f"  Health Score        : {full_data.get('health_score')}/100")
    print(f"  Modo do relatorio   : {e2e_mode}")
    print(f"  Resumo persistido   : {report.get('executive_summary')}")

    if direct_ok and e2e_mode == "llm_assisted":
        print("\n[SUCESSO] Pipeline completo validado com geracao assistida por IA (llm_assisted)!")
        return 0

    print(
        f"\n[AVISO] O pipeline concluiu, porem generation_mode='{e2e_mode}'. "
        "Verifique as credenciais de LLM caso esperasse 'llm_assisted'."
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
