# syntax=docker/dockerfile:1
# data-quality-service (motor analitico com Pandas/NumPy): build em dois estagios.

# ---- Estagio 1: instala as dependencias em um virtualenv isolado ----
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build
COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install -r requirements.txt

# ---- Estagio 2: imagem final (sem cache do pip, usuario nao-root) ----
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    STORAGE_DIR=/app/storage

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY app ./app

# Ponto de montagem do volume com os CSVs (compartilhado com o analysis-service).
RUN mkdir -p /app/storage && chown -R app:app /app

USER app

EXPOSE 8001

# Sem curl na imagem slim: o healthcheck usa o proprio Python.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=4)"

# Segredos e URLs chegam por variaveis de ambiente (nunca fixados na imagem).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
