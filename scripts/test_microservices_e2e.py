import asyncio
import os
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

root = Path(__file__).resolve().parent.parent
load_dotenv(root / ".env")

def load_app(svc_name: str):
    svc_path = str(root / "services" / svc_name)
    sys.path.insert(0, svc_path)
    for k in list(sys.modules.keys()):
        if k == "app" or k.startswith("app."):
            del sys.modules[k]
    mod = __import__("app.main", fromlist=["app"])
    sys.path.remove(svc_path)
    return mod.app

async def run_e2e():
    print("=" * 60)
    print("INICIANDO TESTE PONTA A PONTA (MICROSSERVICOS + SUPABASE)")
    print("=" * 60)

    print("Carregando microsservicos...")
    app_dq = load_app("data-quality-service")
    app_is = load_app("intelligence-service")
    app_as = load_app("analysis-service")

    analysis_id = str(uuid4())
    test_csv_path = str(root / "test_dataset.csv")

    print(f"\n[1/3] Testando data-quality-service com {test_csv_path}...")
    async with AsyncClient(transport=ASGITransport(app=app_dq), base_url="http://test") as client:
        health_resp = await client.get("/health")
        print("  -> Healthcheck:", health_resp.json())
        assert health_resp.status_code == 200

        dq_resp = await client.post(
            "/internal/process",
            json={
                "analysis_id": analysis_id,
                "file_ref": test_csv_path,
                "filename": "test_dataset.csv",
            },
        )
        print("  -> Processamento Status:", dq_resp.status_code)
        assert dq_resp.status_code == 200, dq_resp.text
        dq_data = dq_resp.json()
        print("  -> Profile ID:", dq_data.get("profile_id"))
        print("  -> Achados identificados:", dq_data.get("findings_count"))

        details_resp = await client.get(f"/internal/quality/{analysis_id}")
        assert details_resp.status_code == 200
        quality_details = details_resp.json()
        print("  -> Linhas perfiladas:", quality_details["profile"]["row_count"])
        print("  -> Colunas perfiladas:", quality_details["profile"]["column_count"])

    print(f"\n[2/3] Testando intelligence-service para synthesis...")
    async with AsyncClient(transport=ASGITransport(app=app_is), base_url="http://test") as client:
        health_resp = await client.get("/health")
        print("  -> Healthcheck:", health_resp.json())
        assert health_resp.status_code == 200

        is_resp = await client.post(
            "/internal/synthesize",
            json={
                "analysis_id": analysis_id,
                "row_count": quality_details["profile"]["row_count"],
                "column_count": quality_details["profile"]["column_count"],
                "columns_summary": quality_details["profile"]["columns_summary"],
                "findings": quality_details["findings"],
            },
        )
        print("  -> Sintese Status:", is_resp.status_code)
        assert is_resp.status_code == 200, is_resp.text
        is_data = is_resp.json()
        print("  -> Modo de geracao:", is_data.get("generation_mode"))
        print("  -> Report ID:", is_data.get("report_id"))

        report_resp = await client.get(f"/internal/reports/{analysis_id}")
        assert report_resp.status_code == 200
        report_data = report_resp.json()
        print("  -> Resumo Executivo:", report_data.get("executive_summary")[:100], "...")

    print(f"\n[3/3] Verificando persistencia no PostgreSQL do Supabase...")
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(db_url)
    async with engine.connect() as conn:
        p_res = await conn.execute(text("SELECT count(*) FROM dataset_profiles WHERE analysis_id = :aid"), {"aid": analysis_id})
        f_res = await conn.execute(text("SELECT count(*) FROM quality_findings WHERE analysis_id = :aid"), {"aid": analysis_id})
        r_res = await conn.execute(text("SELECT count(*) FROM analysis_reports WHERE analysis_id = :aid"), {"aid": analysis_id})

        print("  -> Registros em dataset_profiles:", p_res.scalar())
        print("  -> Registros em quality_findings:", f_res.scalar())
        print("  -> Registros em analysis_reports:", r_res.scalar())
    await engine.dispose()

    print("\n" + "=" * 60)
    print("TESTE DE MICROSSERVIÇOS CONCLUÍDO COM SUCESSO TOTAL!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_e2e())
