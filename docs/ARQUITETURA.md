# Especificação da Arquitetura Distribuída — DataGuard

Este documento descreve formalmente a arquitetura de software, a modelagem de dados, a camada de apresentação desacoplada, os contratos de comunicação entre microsserviços, a integração híbrida de inteligência artificial, o tratamento de falhas e resiliência, e o plano de evolução distribuída do projeto **DataGuard**.

---

## 1. Visão Geral e Contexto de Execução

O **DataGuard** é uma plataforma distribuída para perfilamento determinístico e avaliação automatizada de qualidade em dados tabulares (arquivos CSV), enriquecida por uma camada de síntese técnica e contextualização executiva baseada em inteligência artificial híbrida.

### 1.1 Separação Rígida de Responsabilidades

O design do sistema apoia-se em quatro premissas fundamentais:

1. **Quem orquestra não processa:** O `analysis-service` gerencia o ciclo de vida dos jobs e atua como porta de entrada pública, sem realizar cálculos de métricas tabulares.
2. **Quem calcula é 100% determinístico:** O `data-quality-service` realiza o perfilamento estatístico e a detecção de anomalias exclusivamente por código vetorizado (**Pandas** e **NumPy**). O resultado é rigorosamente idempotente e reproduzível para o mesmo conjunto de dados.
3. **Quem sintetiza nunca vê os dados brutos:** O `intelligence-service` recebe unicamente o sumário métrico e os achados estruturados. O arquivo CSV bruto nunca trafega para o serviço de inteligência nem para provedores de IA externos.
4. **Isolamento da interface:** A camada de apresentação (`frontend`) comunica-se unicamente com a API pública do `analysis-service` via REST. Em nenhuma hipótese a interface conecta-se diretamente a bancos de dados, brokers de mensageria ou serviços internos.

---

## 2. Topologia do Sistema: Evolução por Módulos (Nuvem vs. Containers + Mensageria)

Para atender à evolução pedagógica e operacional da disciplina, o repositório preserva compatibilidade entre o **deploy em nuvem sem broker (Módulo 2 — `MESSAGING_ENABLED=false`)** e a **arquitetura distribuída completa conteinerizada orientada a eventos (Módulos 3 e 4 — `MESSAGING_ENABLED=true`)**.

### 2.1 Topologia em Nuvem sem Broker (Módulo 2 — Modo Fallback HTTP)

No deploy gratuito em nuvem (Render + Supabase), onde `MESSAGING_ENABLED=false`, o sistema executa quatro componentes autônomos com comunicação interna síncrona via HTTP:

```mermaid
flowchart LR
    U(["Usuário<br/>Navegador"])

    subgraph RENDER["Render (nuvem) - 4 serviços independentes"]
        FE["dataguard-frontend<br/>React + TypeScript + Vite<br/>site estático"]
        AS["analysis-service<br/>FastAPI - API pública<br/>Orquestrador de jobs"]
        DQ["data-quality-service<br/>FastAPI - /internal<br/>Pandas + NumPy"]
        IS["intelligence-service<br/>FastAPI - /internal<br/>Síntese do laudo"]
    end

    subgraph SUPA["Supabase (nuvem)"]
        PG[("PostgreSQL")]
    end

    subgraph LLM["Provedores de IA (opcionais)"]
        HF["Hugging Face<br/>Qwen2.5-7B-Instruct"]
        OL["Ollama na LAN<br/>qwen2.5:7b"]
    end

    U -->|"HTTPS"| FE
    FE -->|"REST /api<br/>única porta de entrada"| AS
    AS -->|"HTTP POST /internal/process<br/>timeout 10 s"| DQ
    AS -->|"HTTP POST /internal/synthesize<br/>timeout 30 s"| IS
    AS -.->|"HTTP GET /internal/quality<br/>/internal/reports"| DQ
    AS -.-> IS

    AS -->|"analysis_jobs"| PG
    DQ -->|"dataset_profiles<br/>quality_findings"| PG
    IS -->|"analysis_reports"| PG

    IS -.->|"LLM_PROVIDER=huggingface<br/>timeout 15 s"| HF
    IS -.->|"LLM_PROVIDER=ollama<br/>timeout 25 s"| OL
```

### 2.2 Topologia Local Conteinerizada Orientada a Eventos (Módulos 3 e 4 — Implementada)

No ambiente local (`docker-compose.yml`), o DataGuard sobe **seis containers** na rede interna `dataguard` (`postgres`, `rabbitmq`, `analysis-service`, `data-quality-service`, `intelligence-service` e `frontend`) com três volumes nomeados (`pgdata`, `rabbitmq_data` e `storage`) e `MESSAGING_ENABLED=true`:

```mermaid
flowchart LR
    U(["Navegador"])

    subgraph COMPOSE["Docker Compose - rede dataguard"]
        FE["frontend\nNginx :8080\nhost :3000"]
        AS["analysis-service\n:8000"]
        DQ["data-quality-service\n:8001"]
        IS["intelligence-service\n:8002"]
        MQ{{"rabbitmq:3.13-management\nAMQP :5672 | UI :15672\ndataguard.exchange"}}
        DLQ[("dataguard.dlx\n*.dlq")]
        PG[("postgres :5432")]
        V1[/"volume pgdata"/]
        V2[/"volume storage"/]
        V3[/"volume rabbitmq_data"/]
    end

    U -->|"http://localhost:3000"| FE
    U -->|"REST http://localhost:8000/api"| AS
    AS -->|"publica analysis.requested\n(somente IDs e file_ref)"| MQ
    MQ -->|"consome dataguard.quality.requested"| DQ
    DQ -->|"publica started / quality.completed"| MQ
    MQ -->|"consome dataguard.intelligence.requested"| IS
    IS -->|"GET /internal/quality/{id}"| DQ
    IS -->|"publica analysis.completed"| MQ
    MQ -->|"consome dataguard.analysis.status"| AS
    MQ -.->|"nack(requeue=False)"| DLQ
    AS --> PG
    DQ --> PG
    IS --> PG
    PG --- V1
    AS ---|"escrita CSV"| V2
    DQ ---|"leitura CSV"| V2
    MQ --- V3
```

O volume `storage` permite o compartilhamento seguro do CSV entre `analysis-service` e `data-quality-service` sem trafegar o conteúdo bruto do arquivo nas filas AMQP. Cada imagem usa build multi-stage (virtualenv enxuto em `python:3.11-slim`), usuário não-root e `HEALTHCHECK`; o `rabbitmq` utiliza `rabbitmq-diagnostics -q check_port_connectivity` e os três serviços aplicam retry de conexão inicial com `aio-pika` (`connect_robust`).

#### Topologia AMQP Implementada (`infra/rabbitmq/topology.json`)

| Evento (`routing_key`) | Publicador | Fila(s) Durável(is) | Consumidor(es) | DLQ Associada |
| :--- | :--- | :--- | :--- | :--- |
| `analysis.requested` | `analysis-service` | `dataguard.quality.requested` | `data-quality-service` | `dataguard.quality.dlq` |
| `analysis.quality.started` | `data-quality-service` | `dataguard.analysis.status` | `analysis-service` | `dataguard.analysis.dlq` |
| `analysis.quality.completed` | `data-quality-service` | `dataguard.intelligence.requested` e `dataguard.analysis.status` | `intelligence-service` e `analysis-service` | `dataguard.intelligence.dlq` / `dataguard.analysis.dlq` |
| `analysis.completed` | `intelligence-service` | `dataguard.analysis.status` | `analysis-service` | `dataguard.analysis.dlq` |
| `analysis.failed` | `data-quality-service` ou `intelligence-service` | `dataguard.analysis.status` | `analysis-service` | `dataguard.analysis.dlq` |

- **Confirmação manual (`no_ack=False`):** `ack()` é emitido somente após o commit no PostgreSQL e publicação do evento subsequente.
- **Retry controlado e DLQ:** falhas transitórias são republicadas com cabeçalho `x-retry-count` até 3 tentativas (`prefetch_count=1`); falhas permanentes ou retries esgotados emitem `analysis.failed` e chamam `nack(requeue=False)`, isolando a mensagem em `dataguard.dlx`.
- **Idempotência:** os três serviços verificam persistência prévia ou estado terminal/monotônico antes de reprocessar uma mensagem reentregue.

---

## 3. Delimitação de Responsabilidades dos Microsserviços

### 3.1 Analysis Service (Porta de Entrada e Orquestrador)

- **Porta pública:** Expõe rotas `/api/analyses` para o frontend.
- **Validações de entrada:** Verifica formato do arquivo (extensão `.csv`), sanitiza o nome e valida limite máximo de tamanho (padrão de 25 MB).
- **Processamento em streaming:** Salva o arquivo em blocos de 1 MB em disco local/storage para evitar estouro de memória no upload.
- **Resposta imediata:** Grava o job com status `enviada` e retorna HTTP 201 com o `analysis_id` em milissegundos.
- **Agendamento assíncrono:** Dispara o pipeline em segundo plano utilizando `BackgroundTasks` do FastAPI.
- **Agregação do relatório:** Quando a análise é concluída, unifica os dados das tabelas de métricas, achados e laudo, e calcula a nota global de saúde (**Health Score**).

### 3.2 Data Quality Service (Motor Analítico Determinístico)

- **Porta interna:** Expõe endpoints restritos `/internal/process` e `/internal/quality/{id}`.
- **Leitura do dataset:** Carrega o CSV apontado por `file_ref` (ou conteúdo serializado) utilizando Pandas.
- **Perfilamento estatístico:**
  - Colunas numéricas: contagem de válidos, taxa de nulos, média, mediana, desvio padrão, mínimo, quartis e máximo.
  - Colunas categóricas: cardinalidade (valores únicos) e frequência relativa das classes majoritárias.
  - Colunas temporais: menor e maior data, dispersão temporal.
- **Detecção de anomalias (Achados):** Identificação de linhas duplicadas, proporção crítica de nulos por coluna e incompatibilidade de tipos de dados.
- **Persistência especializada:** Grava o perfil estruturado na tabela `dataset_profiles` e os achados individuais na tabela `quality_findings`.

### 3.3 Intelligence Service (Motor de Síntese Técnica e Laudo)

- **Porta interna:** Expõe endpoints `/internal/synthesize`, `/internal/reports/{id}` e `/internal/llm/probe` (diagnóstico de conectividade com o provedor ativo).
- **Entrada estrita:** Recebe exclusivamente o sumário de colunas e a lista de `QualityFinding`.
- **Estratégia híbrida:** Aciona o provedor configurado (Hugging Face Serverless API, Ollama na rede local ou motor de regras local).
- **Saída padronizada:** Gera sumário executivo, interpretação contextual de cada achado, recomendações técnicas de saneamento e limitações observadas.
- **Persistência especializada:** Grava o laudo na tabela `analysis_reports`, sinalizando transparentemente o `generation_mode` utilizado (`llm_assisted` ou `rules_only`).

---

## 4. Ciclo de Vida e Passo a Passo de uma Análise

O diagrama de sequência a seguir ilustra a jornada completa de uma requisição de análise no modo orientado a eventos (**Módulo 4 — `MESSAGING_ENABLED=true`**), desde o upload pelo navegador até a renderização do painel consolidado:

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant FE as Frontend
    participant AS as analysis-service
    participant ST as Volume storage
    participant DB as PostgreSQL
    participant MQ as RabbitMQ (dataguard.exchange)
    participant DQ as data-quality-service
    participant IS as intelligence-service

    U->>FE: Seleciona CSV e envia
    FE->>AS: POST /api/analyses (multipart)
    AS->>AS: Valida extensão .csv e limite de 25 MB
    AS->>ST: Grava CSV em blocos de 1 MB
    AS->>DB: INSERT analysis_jobs (status = enviada)
    AS->>MQ: Publica analysis.requested (analysis_id, file_ref, filename)
    AS-->>FE: 201 Created com analysis_id (resposta imediata)

    par Interface acompanha via polling
        loop A cada 3 s até concluida ou falhou
            FE->>AS: GET /api/analyses/{id}
            AS->>DB: SELECT status
            AS-->>FE: status atual
        end
    and Esteira assíncrona via RabbitMQ
        MQ->>DQ: Entrega analysis.requested (dataguard.quality.requested)
        DQ->>MQ: Publica analysis.quality.started
        MQ->>AS: Entrega analysis.quality.started
        AS->>DB: UPDATE status = analisando (+ ACK)
        DQ->>ST: Lê CSV por file_ref com Pandas
        DQ->>DB: INSERT dataset_profiles e quality_findings
        DQ->>MQ: Publica analysis.quality.completed (+ ACK)
        par Fan-out via topic exchange
            MQ->>AS: Entrega analysis.quality.completed
            AS->>DB: UPDATE status = gerando_relatorio (+ ACK)
        and
            MQ->>IS: Entrega analysis.quality.completed (dataguard.intelligence.requested)
            IS->>DQ: GET /internal/quality/{id} (somente métricas e achados)
            DQ-->>IS: perfil + achados (JSON)
            IS->>IS: Sintetiza laudo (HF / Ollama / fallback rules_only)
            IS->>DB: INSERT analysis_reports
            IS->>MQ: Publica analysis.completed (+ ACK)
        end
        MQ->>AS: Entrega analysis.completed
        AS->>DB: UPDATE status = concluida, completed_at (+ ACK)
    end

    FE->>AS: GET /api/analyses/{id}/report
    AS->>DQ: GET /internal/quality/{id}
    AS->>IS: GET /internal/reports/{id}
    AS->>AS: Agrega e calcula health_score
    AS-->>FE: job + perfil + achados + laudo + nota
```

---

## 5. Máquina de Estados da Análise (`AnalysisJob`)

Cada análise transita de forma estritamente controlada entre estados bem definidos. Os estados `concluida` e `falhou` são **terminais**: ao atingi-los, a interface web encerra automaticamente as consultas de polling.

```mermaid
stateDiagram-v2
    [*] --> enviada: upload aceito
    enviada --> analisando: pipeline inicia
    analisando --> gerando_relatorio: perfil e achados obtidos
    gerando_relatorio --> concluida: laudo persistido
    analisando --> falhou: data-quality indisponível ou lento
    analisando --> falhou: detalhes de qualidade não recuperados
    gerando_relatorio --> falhou: intelligence indisponível ou lento
    concluida --> [*]
    falhou --> [*]
    note right of falhou
        error_code e error_message
        gravados no job
    end note
```

---

## 6. Resiliência, Tratamento de Falhas e Códigos de Erro

Em uma arquitetura distribuída, falhas parciais de rede ou indisponibilidade de serviços dependentes devem ser tratadas com previsibilidade e elegância.

### 6.1 Fluxo de Falha nos Microsserviços e Timeouts

Todas as chamadas HTTP entre microsserviços utilizam timeout estrito de **10 segundos**. Caso um serviço não responda dentro do limite ou retorne erro HTTP, o coordenador cancela a operação imediatamente e atualiza o job no banco de dados com código de erro específico:

```mermaid
flowchart TD
    A["Pipeline inicia<br/>status = analisando"] --> B{"POST data-quality /process<br/>respondeu 200 em até 10 s?"}
    B -->|"Não: timeout, rede ou HTTP diferente de 200"| F1["status = falhou<br/>error_code = DATA_QUALITY_SERVICE_UNAVAILABLE"]
    B -->|"Sim"| C{"GET data-quality /quality/id<br/>retornou 200?"}
    C -->|"Não"| F2["status = falhou<br/>error_code = QUALITY_DETAILS_FETCH_FAILED"]
    C -->|"Sim"| D["status = gerando_relatorio"]
    D --> E{"POST intelligence /synthesize<br/>respondeu 200 em até 30 s?"}
    E -->|"Não"| F3["status = falhou<br/>error_code = INTELLIGENCE_SERVICE_UNAVAILABLE"]
    E -->|"Sim"| OK["status = concluida"]

    F1 --> UI["Frontend mostra FailureCard<br/>com mensagem amigável e código<br/>sem stack trace"]
    F2 --> UI
    F3 --> UI
```

### 6.2 Catálogo de Códigos de Erro Padronizados

| Código de Erro (`error_code`) | Origem / Ponto de Falha | Mensagem Amigável Exibida na UI |
| :--- | :--- | :--- |
| `INVALID_FILE_FORMAT` | Validação no `analysis-service` | Formato de arquivo inválido. Apenas arquivos CSV (.csv) são aceitos. |
| `FILE_TOO_LARGE` | Validação de tamanho no upload | O arquivo excede o limite máximo permitido de 25MB. |
| `STORAGE_WRITE_ERROR` | Falha de disco/IO no upload | Não foi possível gravar o arquivo temporário no storage. |
| `DATA_QUALITY_SERVICE_UNAVAILABLE` | Chamada HTTP `POST /internal/process` (modo fallback) | O motor determinístico de qualidade está temporariamente indisponível ou demorou a responder. |
| `QUALITY_DETAILS_FETCH_FAILED` | Chamada HTTP `GET /internal/quality/{id}` | Não foi possível recuperar os dados de qualidade processados. |
| `INTELLIGENCE_SERVICE_UNAVAILABLE` | Chamada HTTP `POST /internal/synthesize` (modo fallback) | O serviço de inteligência e síntese técnica não pôde concluir o relatório. |
| `MESSAGING_BROKER_UNAVAILABLE` | Publicação AMQP no `analysis-service` | O serviço de mensageria está temporariamente indisponível para enfileirar a análise. |
| `INVALID_EVENT_PAYLOAD` | Validação de envelope AMQP nos workers (DLQ) | Payload inválido recebido pela fila de processamento. |
| `CSV_FILE_NOT_FOUND` | Worker `data-quality-service` (DLQ) | O arquivo CSV enviado não foi encontrado no armazenamento compartilhado. |
| `INVALID_CSV_CONTENT` | Worker `data-quality-service` (DLQ) | Não foi possível interpretar o arquivo CSV. Verifique a estrutura e codificação. |
| `QUALITY_PROCESSING_FAILED` | Worker `data-quality-service` após retries (DLQ) | O motor determinístico de qualidade não pôde processar o arquivo após novas tentativas. |
| `QUALITY_PROFILE_NOT_FOUND` | Worker `intelligence-service` (DLQ) | Não foram encontrados os resultados de qualidade para gerar o relatório técnico. |
| `INTELLIGENCE_PROCESSING_FAILED` | Worker `intelligence-service` após retries (DLQ) | O serviço de inteligência não pôde concluir a síntese do relatório técnico. |

### 6.3 Estratégia de Fallback na Leitura de Relatórios

Ao consultar o endpoint `GET /api/analyses/{id}/report`:

1. O `analysis-service` tenta inicialmente buscar os dados mais recentes via HTTP nos microsserviços internos (`/internal/quality/{id}` e `/internal/reports/{id}`).
2. Caso um ou ambos os microsserviços estejam inalcançáveis no momento da leitura (ex.: serviço reiniciando ou pausado na nuvem), o orquestrador executa um **fallback automático de leitura direta nas tabelas do Supabase**.
3. Dessa forma, análises que já foram concluídas com sucesso no passado **nunca deixam de ser visualizadas** pelo usuário devido a indisponibilidades transitórias dos serviços auxiliares.

### 6.4 Inicialização Resiliente da Aplicação

Os serviços FastAPI contam com rotinas de inicialização seguras (`lifespan`): caso o banco de dados remoto esteja momentaneamente inalcançável durante a subida do container/processo, o serviço emite um log de aviso estruturado e não quebra a inicialização. Isso previne que a plataforma de hospedagem (Render) interprete o deploy como falho por falhas pontuais de conexão com o banco.

---

## 7. Camada de Inteligência Artificial Híbrida e Resiliente

O `intelligence-service` implementa o padrão de projeto **Provedor Abstrato** (*Strategy Pattern*), permitindo selecionar a infraestrutura de inferência via variáveis de ambiente com garantia de fallback determinístico incondicional.

```mermaid
flowchart TD
    CTX["Entrada: DatasetProfile + QualityFinding[]<br/>(nunca o CSV bruto)"] --> CHK{"LLM_ENABLED = true<br/>e LLM_PROVIDER diferente de disabled?"}
    CHK -->|"Não"| RULES["RulesOnlyProvider<br/>motor heurístico determinístico"]
    CHK -->|"Sim"| SW{"LLM_PROVIDER"}
    SW -->|"huggingface"| HF["HuggingFaceProvider<br/>Qwen2.5-7B-Instruct<br/>timeout 15 s"]
    SW -->|"ollama"| OL["OllamaProvider<br/>POST /api/chat, format json<br/>timeout 25 s"]

    HF --> HFOK{"Resposta válida?"}
    OL --> OLOK{"Resposta válida?"}
    HFOK -->|"Sim, JSON"| LLM["generation_mode = llm_assisted"]
    OLOK -->|"Sim, JSON"| LLM
    HFOK -->|"429, 503, timeout, JSON inválido, sem token"| LOG["Log estruturado do erro<br/>e aviso de fallback"]
    OLOK -->|"Host da LAN inacessível, timeout, JSON inválido"| LOG
    LOG --> RULES

    RULES --> RM["generation_mode = rules_only"]
    LLM --> SAVE["Persistir em analysis_reports"]
    RM --> SAVE
```

### 7.1 Provedores Suportados

1. **Hugging Face Inference Providers Router (Padrão em Nuvem):**
   - **Modelo:** `Qwen/Qwen2.5-7B-Instruct`.
   - **Comunicação:** HTTPS via endpoint compatível com Chat Completions (`https://router.huggingface.co/v1/chat/completions`) utilizando token de serviço (`HF_TOKEN` com permissão *Make calls to Inference Providers*).
   - **Controle de Timeout:** 15 segundos.
   - **Tolerância a Falhas:** Captura status 429 (rate-limit) e 503 (cold start), acionando o fallback local sem quebrar o job.
2. **Ollama em Servidor LAN (GPU de Alta Performance):**
   - **Modelo:** `qwen2.5:7b` (ou `llama3.2:3b`).
   - **Cenário:** Execução em máquina local dedicada na rede do laboratório/universidade (servidor com GPU, 64GB DDR5 e 2TB NVMe).
   - **Comunicação:** `http://<LAN_IP>:11434/api/chat` com formato estruturado `"format": "json"`.
   - **Controle de Timeout:** 25 segundos.
   - **Resiliência a Desconexão:** Se o desenvolvedor ou o serviço estiver fora da rede interna, a falha de rota é capturada com log explícito e o fallback entra em ação.
3. **Motor Heurístico Determinístico (`rules_only`):**
   - Constrói o laudo técnico por meio de algoritmos baseados em regras codificadas em Python.
   - Execução instantânea (latência < 5 ms), sem dependência de chaves de API, GPU ou rede externa.

---

## 8. Cálculo Unificado do Health Score

Para prover um indicador claro e objetivo de conformidade do conjunto de dados, o `analysis-service` calcula uma nota global de 0 a 100 com base na quantidade e severidade dos achados determinísticos catalogados pelo `data-quality-service`:

$$\text{Health Score} = \max\left(0, \min\left(100, 100 - (15 \times N_{\text{critical}}) - (5 \times N_{\text{warning}}) - (1 \times N_{\text{info}})\right)\right)$$

- **Achados Críticos (`critical`):** Deduzem 15 pontos cada (ex.: taxas massivas de nulos em colunas-chave, anomalias estruturais severas).
- **Achados de Alerta (`warning`):** Deduzem 5 pontos cada (ex.: duplicações parciais, colunas com tipos potencialmente corrompidos).
- **Achados Informativos (`info`):** Deduzem 1 ponto cada (ex.: observações sobre cardinalidade ou formatações inconsistentes).
- **Classificação:**
  - **90 a 100:** Excelente integridade (Badge Verde).
  - **70 a 89:** Atenção recomendada (Badge Amarelo/Warn).
  - **Abaixo de 70:** Risco crítico de dados (Badge Vermelho/Danger).

---

## 9. Modelo Relacional e Persistência de Dados (Supabase)

O esquema relacional garante integridade referencial através do identificador unificado `analysis_id`:

```mermaid
erDiagram
    ANALYSIS_JOBS ||--o| DATASET_PROFILES : "analysis_id"
    ANALYSIS_JOBS ||--o{ QUALITY_FINDINGS : "analysis_id"
    ANALYSIS_JOBS ||--o{ ANALYSIS_REPORTS : "analysis_id"

    ANALYSIS_JOBS {
        uuid id PK
        string original_filename
        bigint file_size_bytes
        string file_ref
        string status
        string error_code
        text error_message
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at
    }
    DATASET_PROFILES {
        uuid id PK
        uuid analysis_id
        int row_count
        int column_count
        jsonb columns_summary
        timestamptz generated_at
    }
    QUALITY_FINDINGS {
        uuid id PK
        uuid analysis_id
        string code
        string severity
        string target_column
        text description
        float metric_value
        text evidence
    }
    ANALYSIS_REPORTS {
        uuid id PK
        uuid analysis_id
        text executive_summary
        jsonb key_insights
        jsonb recommended_actions
        jsonb limitations
        string generation_mode
        timestamptz generated_at
    }
```

---

## 10. Decisões de Projeto e Limitações Conhecidas

Como parte do rigor arquitetural do projeto, destacam-se decisões conscientes tomadas ao longo dos quatro módulos e seus caminhos de evolução:

1. **Mensageria Distribuída (RabbitMQ) com Flag de Compatibilidade (`MESSAGING_ENABLED`):**
   - *Evolução Implementada (Módulo 4):* O pipeline em Docker Compose passou a operar inteiramente via **RabbitMQ** (`MESSAGING_ENABLED=true`), garantindo persistência de mensagens em filas duráveis, tolerância a quedas temporárias de workers, ACK manual, retry controlado, DLQ e idempotência.
   - *Compatibilidade Nuvem:* O fallback via `BackgroundTasks` HTTP permanece disponível quando `MESSAGING_ENABLED=false`, preservando o funcionamento do deploy gratuito em nuvem (Render) sem exigir um broker externo pago.
2. **Armazenamento de Arquivos em Volume Compartilhado:**
   - *Decisão Atual:* No Docker Compose, o CSV é gravado no volume nomeado `storage` e lido diretamente por `file_ref` pelo `data-quality-service`, nunca trafegando na fila AMQP.
   - *Evolução Multi-Host:* Em produção distribuída entre hosts físicos distintos, o volume compartilhado pode ser substituído por object storage compatível com S3 (MinIO, AWS S3 ou Cloudflare R2) mantendo exatamente o mesmo contrato de `file_ref`.
3. **Compartilhamento de Banco de Dados:**
   - *Decisão Atual:* Os três microsserviços acessam o mesmo banco PostgreSQL, cada qual atuando sobre suas respectivas tabelas (`analysis_jobs`, `dataset_profiles`/`quality_findings` e `analysis_reports`).
   - *Vantagem:* Permitiu implementar o fallback de leitura de relatórios sem barramentos adicionais.
   - *Evolução:* A segregação física em bancos separados pode ser aplicada conforme crescimento de carga.

---

## 11. Comparativo Teórico: Mensageria (RabbitMQ) vs Streaming (Kafka/Redpanda)

Para fundamentação teórica completa aplicada ao DataGuard (incluindo projeção de tópicos, *consumer groups*, replay histórico e critérios de migração), consulte o estudo dedicado em **[docs/MENSAGERIA_VS_STREAMING.md](MENSAGERIA_VS_STREAMING.md)**.

```mermaid
flowchart TD
    subgraph Mensageria["Abordagem por Mensageria Tradicional (RabbitMQ - Implementado no Módulo 4)"]
        P1["Produtor (Analysis Service)"] -->|Publica| EX["Exchange: dataguard.exchange"]
        EX -->|Roteia| Q1["Fila de Tarefas: dataguard.quality.requested"]
        Q1 -->|Entrega e Remove após ACK| C1["Consumidor (Data Quality)"]
    end

    subgraph Streaming["Abordagem por Streaming de Eventos (Apache Kafka / Redpanda - Projeção Teórica)"]
        P2["Produtor (Analysis Service)"] -->|Append-Only| TOPIC["Tópico Particionado: 'dataguard.analysis.events'"]
        TOPIC -->|Offset 0, 1, 2... (Log Persistente)| TOPIC
        TOPIC -->|Leitura por Offset sem Remoção| CG1["Consumer Group: Data Quality"]
        TOPIC -->|Replay / Leitura Independente| CG2["Consumer Group: Auditoria & Analytics"]
    end
```

<div align="center">

| Critério Arquitetural | RabbitMQ (Implementado no DataGuard) | Apache Kafka / Redpanda (Streaming) |
| :--- | :--- | :--- |
| **Paradigma Central** | **Broker de Mensagens Inteligente:** Focado em filas de trabalho pontuais e roteamento flexível. | **Log Distribuído Gravado em Disco:** Focado em retenção durável e imutável de eventos ordenados. |
| **Ciclo de Vida do Dado** | Transiente: A mensagem é excluída da fila assim que o worker confirma o processamento (`basic_ack`). | Durável: Eventos permanecem gravados de acordo com a política de retenção em disco configurada. |
| **Controle de Leitura** | Gerenciado pelo broker: o RabbitMQ monitora o envio e a confirmação de cada mensagem. | Gerenciado pelo consumidor: cada grupo mantém seu próprio ponteiro de leitura (**offset**). |
| **Capacidade de Replay** | Baixa ou inexistente sem republicação explícita de mensagens. | Alta: Permite reposicionar o offset no passado e reprocessar eventos a qualquer momento. |
| **Adequação ao DataGuard** | **Ideal para o projeto:** Cada upload de arquivo CSV é uma tarefa unitária de processamento analítico discreto. | Justificável em evolução futura com ingestão contínua de registros, replay de regras e múltiplos consumidores de BI/auditoria. |

</div>
