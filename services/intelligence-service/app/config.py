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
    INTERNAL_TIMEOUT_SECONDS: float = 10.0

    MESSAGING_ENABLED: bool = False
    RABBITMQ_URL: str = ""
    RABBITMQ_EXCHANGE: str = "dataguard.exchange"
    RABBITMQ_DLX: str = "dataguard.dlx"
    RABBITMQ_PREFETCH_COUNT: int = 1
    RABBITMQ_MAX_RETRIES: int = 3
    RABBITMQ_RETRY_DELAY_SECONDS: float = 2.0

    # Config da IA Híbrida
    LLM_ENABLED: bool = True
    LLM_PROVIDER: str = "huggingface"  # "huggingface", "ollama" ou "disabled"

    # HuggingFace (Inference Providers Router — compatível com Chat Completions)
    HF_TOKEN: str = ""
    HF_MODEL_ID: str = "Qwen/Qwen2.5-7B-Instruct"
    HF_API_URL: str = "https://router.huggingface.co/v1/chat/completions"
    HF_TIMEOUT_SECONDS: float = 15.0

    # Ollama na rede local
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:7b"
    OLLAMA_TIMEOUT_SECONDS: float = 25.0

    CORS_ORIGINS: list[str] = ["*"]

    @field_validator("LLM_PROVIDER", mode="after")
    @classmethod
    def normalize_provider(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("HF_TOKEN", mode="after")
    @classmethod
    def sanitize_hf_token(cls, v: str) -> str:
        cleaned = v.strip().strip('"').strip("'").strip()
        if cleaned in {"", "SEU_TOKEN_AQUI", "hf_seuTokenAqui"}:
            return ""
        return cleaned

    @field_validator("HF_API_URL", mode="after")
    @classmethod
    def normalize_hf_api_url(cls, v: str) -> str:
        cleaned = v.strip().strip('"').strip("'")
        if (
            not cleaned
            or "api-inference.huggingface.co" in cleaned
            or "router.huggingface.co/hf-inference/v1/chat/completions" in cleaned
        ):
            return "https://router.huggingface.co/v1/chat/completions"
        return cleaned

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
