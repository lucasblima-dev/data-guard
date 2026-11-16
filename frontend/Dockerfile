# syntax=docker/dockerfile:1
# Frontend: build com Vite (Node) e entrega dos estaticos por Nginx sem privilegios.

# ---- Estagio 1: compila a SPA ----
FROM node:22-alpine AS build

WORKDIR /app

# Instala dependencias primeiro para aproveitar o cache de camadas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# O Vite embute estas variaveis no bundle em tempo de build (nao sao segredos).
# VITE_API_URL e a URL que o NAVEGADOR usa para chegar ao analysis-service.
ARG VITE_API_URL=http://localhost:8000/api
ARG VITE_USE_MOCKS=false
ARG VITE_MAX_UPLOAD_MB=25
ENV VITE_API_URL=$VITE_API_URL \
    VITE_USE_MOCKS=$VITE_USE_MOCKS \
    VITE_MAX_UPLOAD_MB=$VITE_MAX_UPLOAD_MB

RUN npm run build

# ---- Estagio 2: servidor estatico enxuto, rodando como usuario nao-root ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
