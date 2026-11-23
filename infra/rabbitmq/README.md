# Topologia RabbitMQ — DataGuard

Este diretório documenta a topologia de mensageria AMQP utilizada pelo **DataGuard** no Módulo 4.

A declaração de exchanges, filas duráveis, bindings e Dead Letter Queues (DLQs) é executada de forma **idempotente** pelos próprios microsserviços no startup (`aio-pika`), evitando credenciais hardcoded em arquivos de definição estáticos e mantendo a autenticação 100% controlada pelas variáveis de ambiente `RABBITMQ_USER` e `RABBITMQ_PASSWORD`.

O manifesto [topology.json](topology.json) representa o contrato formal compartilhado entre todos os publicadores e consumidores.

## Exchanges

| Exchange | Tipo | Durável | Finalidade |
| :--- | :--- | :---: | :--- |
| `dataguard.exchange` | `topic` | Sim | Roteamento dos eventos de domínio do ciclo de vida das análises |
| `dataguard.dlx` | `direct` | Sim | Dead Letter Exchange para isolamento de mensagens com falha permanente ou retries esgotados |

## Filas e Bindings

| Fila | Routing Key(s) | Consumidor | DLQ Associada |
| :--- | :--- | :--- | :--- |
| `dataguard.quality.requested` | `analysis.requested` | `data-quality-service` | `dataguard.quality.dlq` |
| `dataguard.intelligence.requested` | `analysis.quality.completed` | `intelligence-service` | `dataguard.intelligence.dlq` |
| `dataguard.analysis.status` | `analysis.quality.started`, `analysis.quality.completed`, `analysis.completed`, `analysis.failed` | `analysis-service` | `dataguard.analysis.dlq` |

## Acesso ao Painel de Gerenciamento

Com o ambiente ativo via `docker compose up -d`:

- **Broker AMQP:** `amqp://<RABBITMQ_USER>:<RABBITMQ_PASSWORD>@localhost:5672/`
- **RabbitMQ Management UI:** `http://localhost:15672` (credenciais definidas no `.env`)
