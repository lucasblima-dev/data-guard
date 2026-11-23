# Changelog — DataGuard

Registro da evolução incremental do projeto **DataGuard** ao longo dos quatro módulos práticos da disciplina de **Sistemas Distribuídos (UERN)**.

---

## Módulo 4 — Mensageria e Streaming de Eventos (`feature/mensageria`)

- **Infraestrutura RabbitMQ:** adição do container `rabbitmq:3.13-management-alpine` ao `docker-compose.yml` com volume persistente `rabbitmq_data`, painel de gerenciamento na porta `15672` e healthcheck `check_port_connectivity`.
- **Topologia AMQP documentada e declarativa:** criação de `infra/rabbitmq/topology.json` e `infra/rabbitmq/README.md` com `dataguard.exchange` (`topic`), `dataguard.dlx` (`direct`), filas duráveis (`dataguard.quality.requested`, `dataguard.intelligence.requested`, `dataguard.analysis.status`) e DLQs dedicadas.
- **Pipeline orientado a eventos (`aio-pika`):**
  - `analysis-service`: publicação de `analysis.requested` (apenas metadados e `file_ref`, nunca o CSV bruto), consumo de eventos de status com máquina de estados monotônica e idempotente, e flag `MESSAGING_ENABLED` preservando compatibilidade com o deploy no Render.
  - `data-quality-service`: consumo de `analysis.requested`, leitura estrita no volume compartilhado `/app/storage`, publicação de `analysis.quality.started` e `analysis.quality.completed`, idempotência, retry controlado (`x-retry-count`) e DLQ.
  - `intelligence-service`: consumo de `analysis.quality.completed`, consulta interna de métricas, síntese híbrida com fallback determinístico, publicação de `analysis.completed`, idempotência, retry controlado e DLQ.
- **Frontend:** melhorias no `StatusStepper`, `AnalysisPage`, `FailureCard` (novos códigos de erro orientados a eventos) e auto-atualização do Histórico enquanto houver análises em fila.
- **Testes E2E e Documentação:** criação da suíte `scripts/test_messaging_e2e.py` (5 cenários automatizados), atualização do `README.md` e `docs/ARQUITETURA.md`, e publicação do estudo comparativo `docs/MENSAGERIA_VS_STREAMING.md`.

---

## Módulo 3 — Containers (`docker-compose`)

- Empacotamento individual de `analysis-service`, `data-quality-service`, `intelligence-service` e `frontend` com `Dockerfile` multi-stage, usuário não-root e `HEALTHCHECK`.
- Orquestração local via `docker-compose.yml` com PostgreSQL 16 em container e volumes persistentes `pgdata` e `storage`.
- Validação de persistência entre ciclos `docker compose down` / `up` e comparativo entre deploy direto na nuvem e execução conteinerizada no `README.md`.

---

## Módulo 2 — Serviços e Microsserviços

- Decomposição do backend em três serviços independentes (`analysis-service`, `data-quality-service` e `intelligence-service`) com comunicação HTTP síncrona, timeouts controlados e fallback de leitura no PostgreSQL.
- Implementação da camada de IA híbrida (Hugging Face Serverless, Ollama em rede local e fallback determinístico `rules_only`).
- Integração completa com o frontend SPA desacoplado em React, TypeScript, Vite e Tailwind CSS v4 (incluindo relatório imprimível A4 e responsividade).

---

## Módulo 1 — Computação em Nuvem

- Implementação da API REST base (`analysis-service`) com CRUD completo da entidade `AnalysisJob` e persistência em PostgreSQL gerenciado (Supabase).
- Deploy em nuvem via Render (`render.yaml`) com variáveis de ambiente isoladas e scripts automatizados de validação (`scripts/test_api.ps1` e `scripts/test_api.sh`).
