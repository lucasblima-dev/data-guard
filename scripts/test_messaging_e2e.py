"""Teste ponta a ponta que valida os 5 Cenários obrigatorios utilizando
do Python + HTTP REST do analysis-service + RabbitMQ Management API + Docker Compose:

  1. Fluxo feliz assincrono (upload -> RabbitMQ -> quality -> intelligence -> report)
  2. Resiliencia e desacoplamento com worker parado (stop/start data-quality-service)
  3. Dead Letter Queue (DLQ) com mensagem malformada
  4. Idempotencia (reentrega de analysis.requested sem duplicar registros no PostgreSQL)
  5. Concorrencia em lote (multiplos uploads em sequencia)

Uso:
  python scripts/test_messaging_e2e.py
  python scripts/test_messaging_e2e.py --keep-data
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

ROOT_DIR = Path(__file__).resolve().parent.parent

SAMPLE_CSV = (
    "id,categoria,valor,score\n"
    "1,A,10.5,0.85\n"
    "2,B,23.0,0.92\n"
    "3,A,,0.77\n"
    "4,,45.2,0.64\n"
    "5,B,50.0,0.95\n"
    "5,B,50.0,0.95\n"
)


def load_dotenv_file(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        values[key] = val
    return values


def get_env(dotenv: dict[str, str], key: str, default: str = "") -> str:
    return os.environ.get(key) or dotenv.get(key) or default


def http_json(
    url: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
) -> tuple[int, Any]:
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} em {method} {url}: {body}") from exc


def upload_csv(base_url: str, filename: str, csv_content: str) -> dict[str, Any]:
    boundary = f"----DataGuardBoundary{uuid4().hex}"
    body_parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"),
        b"Content-Type: text/csv\r\n\r\n",
        csv_content.encode("utf-8"),
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    body = b"".join(body_parts)
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/analyses",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20.0) as resp:
        assert resp.status == 201, f"Esperado HTTP 201, recebido {resp.status}"
        return json.loads(resp.read().decode("utf-8"))


def wait_for_status(
    base_url: str,
    job_id: str,
    expected_statuses: set[str],
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_job: dict[str, Any] = {}
    while time.monotonic() < deadline:
        _, last_job = http_json(f"{base_url.rstrip('/')}/analyses/{job_id}")
        if last_job.get("status") in expected_statuses:
            return last_job
        time.sleep(0.5)
    raise TimeoutError(
        f"Job {job_id} nao atingiu {expected_statuses} em {timeout_seconds}s "
        f"(ultimo status: {last_job.get('status')})."
    )


def rabbitmq_headers(user: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def rabbitmq_get_queue(
    rmq_api: str,
    headers: dict[str, str],
    queue_name: str,
) -> dict[str, Any]:
    encoded_q = urllib.parse.quote(queue_name, safe="")
    _, data = http_json(
        f"{rmq_api.rstrip('/')}/queues/%2F/{encoded_q}",
        headers=headers,
    )
    return data


def wait_for_queue_metric(
    rmq_api: str,
    headers: dict[str, str],
    queue_name: str,
    metric_key: str,
    min_value: int,
    timeout_seconds: float = 12.0,
) -> int:
    deadline = time.monotonic() + timeout_seconds
    last_val = 0
    while time.monotonic() < deadline:
        info = rabbitmq_get_queue(rmq_api, headers, queue_name)
        last_val = int(info.get(metric_key, 0))
        if last_val >= min_value:
            return last_val
        time.sleep(0.5)
    return last_val


def rabbitmq_publish(
    rmq_api: str,
    headers: dict[str, str],
    exchange: str,
    routing_key: str,
    payload_str: str,
) -> None:
    encoded_ex = urllib.parse.quote(exchange, safe="")
    _, resp = http_json(
        f"{rmq_api.rstrip('/')}/exchanges/%2F/{encoded_ex}/publish",
        method="POST",
        headers=headers,
        payload={
            "properties": {"delivery_mode": 2, "content_type": "application/json"},
            "routing_key": routing_key,
            "payload": payload_str,
            "payload_encoding": "string",
        },
    )
    assert resp and resp.get("routed") is True, f"Evento nao roteado para '{routing_key}': {resp}"


def rabbitmq_purge_queue(rmq_api: str, headers: dict[str, str], queue_name: str) -> None:
    encoded_q = urllib.parse.quote(queue_name, safe="")
    http_json(
        f"{rmq_api.rstrip('/')}/queues/%2F/{encoded_q}/contents",
        method="DELETE",
        headers=headers,
    )


def run_docker_compose(*args: str) -> str:
    result = subprocess.run(
        ["docker", "compose", *args],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def query_postgres_count(pg_user: str, pg_db: str, table: str, analysis_id: str) -> int:
    sql = f"SELECT count(*) FROM {table} WHERE analysis_id = '{analysis_id}';"
    output = run_docker_compose(
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        pg_user,
        "-d",
        pg_db,
        "-t",
        "-A",
        "-c",
        sql,
    )
    return int(output.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="Suite E2E de mensageria RabbitMQ do DataGuard.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000/api")
    parser.add_argument("--rabbitmq-api", default="http://127.0.0.1:15672/api")
    parser.add_argument("--skip-resilience", action="store_true", help="Pula teste stop/start de container.")
    parser.add_argument("--keep-data", action="store_true", help="Mantem jobs criados e mensagens na DLQ.")
    args = parser.parse_args()

    dotenv = load_dotenv_file(ROOT_DIR / ".env")
    rmq_user = get_env(dotenv, "RABBITMQ_USER")
    rmq_pass = get_env(dotenv, "RABBITMQ_PASSWORD")
    rmq_exchange = get_env(dotenv, "RABBITMQ_EXCHANGE", "dataguard.exchange")
    pg_user = get_env(dotenv, "POSTGRES_USER", "dataguard")
    pg_db = get_env(dotenv, "POSTGRES_DB", "dataguard")

    if not rmq_user or not rmq_pass:
        print("ERRO: Defina RABBITMQ_USER e RABBITMQ_PASSWORD no arquivo .env.", file=sys.stderr)
        return 1

    rmq_hdrs = rabbitmq_headers(rmq_user, rmq_pass)
    created_job_ids: list[str] = []

    print("=" * 68)
    print("DATAGUARD - SUITE E2E DE MENSAGERIA E EVENTOS (MODULO 4)")
    print("=" * 68)

    try:
        # Pre-check: health endpoints
        print("\n[0/5] Verificando saude e conexao AMQP dos 3 microsservicos...")
        for name, url in [
            ("analysis-service", "http://127.0.0.1:8000/health"),
            ("data-quality-service", "http://127.0.0.1:8001/health"),
            ("intelligence-service", "http://127.0.0.1:8002/health"),
        ]:
            _, health = http_json(url)
            assert health.get("messaging_enabled") == "True", f"{name} sem mensageria ativa: {health}"
            assert health.get("messaging_connected") == "True", f"{name} desconectado do RabbitMQ: {health}"
            print(f"  OK {name}: messaging_connected=True")

        print("\n[1/5] Cenário 1 - Fluxo Feliz Assincrono (upload -> eventos -> relatorio)...")
        job1 = upload_csv(args.base_url, "e2e_fluxo_feliz.csv", SAMPLE_CSV)
        job1_id = job1["id"]
        created_job_ids.append(job1_id)
        assert job1["status"] == "enviada", f"Status inicial inesperado: {job1['status']}"

        finished1 = wait_for_status(args.base_url, job1_id, {"concluida", "falhou"})
        assert finished1["status"] == "concluida", f"Job 1 falhou: {finished1}"

        _, report1 = http_json(f"{args.base_url.rstrip('/')}/analyses/{job1_id}/report")
        assert report1["profile"]["row_count"] == 6
        assert report1["profile"]["column_count"] == 4
        assert len(report1["findings"]) >= 1
        assert report1["report"] is not None
        assert report1["health_score"] is not None
        print(
            f"  OK Job {job1_id}: status=concluida, rows=6, cols=4, "
            f"findings={len(report1['findings'])}, health_score={report1['health_score']}, "
            f"mode={report1['report']['generation_mode']}"
        )

        if args.skip_resilience:
            print("\n[2/5] Cenário 2 - Resiliencia ignorado (--skip-resilience).")
        else:
            print("\n[2/5] Cenário 2 - Resiliencia com data-quality-service parado...")
            run_docker_compose("stop", "data-quality-service")
            try:
                job2 = upload_csv(args.base_url, "e2e_resiliencia.csv", SAMPLE_CSV)
                job2_id = job2["id"]
                created_job_ids.append(job2_id)
                assert job2["status"] == "enviada"

                ready_count = wait_for_queue_metric(
                    args.rabbitmq_api,
                    rmq_hdrs,
                    "dataguard.quality.requested",
                    "messages_ready",
                    min_value=1,
                    timeout_seconds=12.0,
                )
                assert ready_count >= 1, f"Esperado >= 1 mensagem retida na fila, encontrado {ready_count}"
                print(f"  OK Upload aceito com worker fora do ar (dataguard.quality.requested ready={ready_count})")
            finally:
                run_docker_compose("start", "data-quality-service")

            finished2 = wait_for_status(args.base_url, job2_id, {"concluida", "falhou"}, timeout_seconds=45.0)
            assert finished2["status"] == "concluida", f"Job 2 falhou apos retorno do worker: {finished2}"
            print(f"  OK Worker religado consumiu automaticamente e concluiu job {job2_id}")

        print("\n[3/5] Cenário 3 - Dead Letter Queue (mensagem invalida -> dataguard.quality.dlq)...")
        dlq_before = int(
            rabbitmq_get_queue(args.rabbitmq_api, rmq_hdrs, "dataguard.quality.dlq").get("messages", 0)
        )
        rabbitmq_publish(
            args.rabbitmq_api,
            rmq_hdrs,
            rmq_exchange,
            "analysis.requested",
            "{payload_json_corrompido",
        )

        dlq_after = dlq_before
        deadline = time.monotonic() + 15.0
        while time.monotonic() < deadline:
            dlq_after = int(
                rabbitmq_get_queue(args.rabbitmq_api, rmq_hdrs, "dataguard.quality.dlq").get("messages", 0)
            )
            if dlq_after > dlq_before:
                break
            time.sleep(0.5)

        assert dlq_after > dlq_before, (
            f"Mensagem invalida nao chegou na DLQ (antes={dlq_before}, depois={dlq_after})."
        )
        print(f"  OK Mensagem rejeitada com nack(requeue=False) e isolada em dataguard.quality.dlq (total={dlq_after})")

        print("\n[4/5] Cenário 4 - Idempotencia (reentrega de analysis.requested sem duplicacao)...")
        duplicate_event = {
            "event_id": str(uuid4()),
            "event_type": "analysis.requested",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "version": 1,
            "correlation_id": job1_id,
            "payload": {
                "analysis_id": job1_id,
                "file_ref": job1["file_ref"],
                "filename": job1["original_filename"],
            },
        }
        rabbitmq_publish(
            args.rabbitmq_api,
            rmq_hdrs,
            rmq_exchange,
            "analysis.requested",
            json.dumps(duplicate_event),
        )
        time.sleep(2.5)

        profile_rows = query_postgres_count(pg_user, pg_db, "dataset_profiles", job1_id)
        report_rows = query_postgres_count(pg_user, pg_db, "analysis_reports", job1_id)
        assert profile_rows == 1, f"Idempotencia violada em dataset_profiles: {profile_rows} registros"
        assert report_rows == 1, f"Idempotencia violada em analysis_reports: {report_rows} registros"
        print(
            f"  OK Reentrega ignorada de forma idempotente "
            f"(dataset_profiles={profile_rows}, analysis_reports={report_rows})"
        )

        print("\n[5/5] Cenário 5 - Concorrência em lote (3 uploads sequenciais rapidos)...")
        batch_ids: list[str] = []
        for idx in range(1, 4):
            batch_job = upload_csv(args.base_url, f"e2e_lote_{idx}.csv", SAMPLE_CSV)
            batch_ids.append(batch_job["id"])
            created_job_ids.append(batch_job["id"])

        for batch_id in batch_ids:
            done_job = wait_for_status(args.base_url, batch_id, {"concluida", "falhou"}, timeout_seconds=45.0)
            assert done_job["status"] == "concluida", f"Job de lote {batch_id} falhou: {done_job}"
        print(f"  OK Todos os {len(batch_ids)} uploads em lote concluiram com sucesso")

    finally:
        if not args.keep_data:
            print("\n[Limpeza] Removendo jobs de teste e limpando mensagem de teste da DLQ...")
            for jid in created_job_ids:
                try:
                    http_json(f"{args.base_url.rstrip('/')}/analyses/{jid}", method="DELETE")
                except Exception:
                    pass
            try:
                rabbitmq_purge_queue(args.rabbitmq_api, rmq_hdrs, "dataguard.quality.dlq")
            except Exception:
                pass

    print("\n" + "=" * 68)
    print("TODOS OS 5 CENARIOS DE MENSAGERIA PASSARAM COM SUCESSO!")
    print("=" * 68)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
