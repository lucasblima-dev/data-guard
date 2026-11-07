import asyncio
import os
from pathlib import Path
import sys

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

root = Path(__file__).resolve().parent.parent
load_dotenv(root / ".env")

db_url = os.getenv("DATABASE_URL", "")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

def clear_app_modules():
    for k in list(sys.modules.keys()):
        if k == "app" or k.startswith("app."):
            del sys.modules[k]

async def init_schema():
    print("Conectando ao Supabase para inicializar schemas...")
    engine = create_async_engine(db_url)

    # analysis-service
    clear_app_modules()
    sys.path.insert(0, str(root / "services" / "analysis-service"))
    from app.models.job import Base as JobBase
    async with engine.begin() as conn:
        print("Criando tabelas de analysis-service...")
        await conn.run_sync(JobBase.metadata.create_all)
    sys.path.remove(str(root / "services" / "analysis-service"))

    # data-quality-service
    clear_app_modules()
    sys.path.insert(0, str(root / "services" / "data-quality-service"))
    from app.models.quality import Base as QualityBase
    async with engine.begin() as conn:
        print("Criando tabelas de data-quality-service...")
        await conn.run_sync(QualityBase.metadata.create_all)
    sys.path.remove(str(root / "services" / "data-quality-service"))

    # intelligence-service
    clear_app_modules()
    sys.path.insert(0, str(root / "services" / "intelligence-service"))
    from app.models.report import Base as ReportBase
    async with engine.begin() as conn:
        print("Criando tabelas de intelligence-service...")
        await conn.run_sync(ReportBase.metadata.create_all)
    sys.path.remove(str(root / "services" / "intelligence-service"))

    await engine.dispose()
    print("Todas as tabelas foram inicializadas no Supabase com sucesso!")

if __name__ == "__main__":
    asyncio.run(init_schema())
