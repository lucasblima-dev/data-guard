from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "DataGuard Intelligence Service"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    HOST: str = "0.0.0.0"
    PORT: int = 8002
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = (
        "postgresql+asyncpg://dataguard:dataguard_secret@localhost:5432/dataguard_db"
    )

    DATA_QUALITY_SERVICE_URL: str = "http://localhost:8001"
    ANALYSIS_SERVICE_URL: str = "http://localhost:8000"

    # Config da IA Híbrida
    LLM_ENABLED: bool = True
    LLM_PROVIDER: str = "huggingface"  # "huggingface", "ollama" ou "disabled"

    # HuggingFace
    HF_TOKEN: str = ""
    HF_MODEL_ID: str = "Qwen/Qwen2.5-7B-Instruct"
    HF_TIMEOUT_SECONDS: float = 15.0

    # Ollama na rede local
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    OLLAMA_TIMEOUT_SECONDS: float = 25.0

    CORS_ORIGINS: list[str] = ["*"]

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def assemble_async_db_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
