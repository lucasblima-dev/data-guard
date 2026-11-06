/**
 * Mocks de desenvolvimento para os endpoints que o analysis-service ainda nao expoe
 * (upload e relatorio). Ativos por padrao; desligue com VITE_USE_MOCKS=false.
 * Todo o conteudo e ficticio.
 */
import type {
  AnalysisJob,
  ColumnSummary,
  FullAnalysisDetails,
  JobStatus,
  QualityFinding,
  QualityReport,
} from "../types/analysis";
import { ApiError } from "./client";

export const MOCKS_ENABLED = import.meta.env.VITE_USE_MOCKS !== "false";
export const MOCK_LATENCY_MS = 2000;

/** Espera `ms`, rejeitando com CANCELED se o AbortSignal disparar (mesmo contrato do axios). */
export function mockDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ApiError("Requisição cancelada.", "CANCELED", null));
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new ApiError("Requisição cancelada.", "CANCELED", null));
      },
      { once: true },
    );
  });
}

/* ------------------------------------------------------------------ */
/* Jobs simulados: o status avanca com o tempo, para exercitar o stepper */
/* ------------------------------------------------------------------ */

interface MockJobRecord {
  id: string;
  filename: string;
  size: number;
  createdAt: number; // epoch ms
  /** Nomes de arquivo contendo "falha" ou "erro" simulam um job que falha. */
  willFail: boolean;
}

const STORAGE_KEY = "dg-mock-jobs";

function loadJobs(): Record<string, MockJobRecord> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, MockJobRecord>;
  } catch {
    return {};
  }
}

function saveJobs(jobs: Record<string, MockJobRecord>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    /* storage indisponivel: o mock segue valido enquanto a aba estiver aberta */
  }
}

const memory: Record<string, MockJobRecord> = loadJobs();

export function isMockJob(id: string): boolean {
  return id in memory;
}

/** Linha do tempo (ms desde a criacao) em que cada status e atingido. */
const TIMELINE: { status: JobStatus; from: number }[] = [
  { status: "enviada", from: 0 },
  { status: "validando", from: 2500 },
  { status: "analisando", from: 6000 },
  { status: "gerando_relatorio", from: 11000 },
  { status: "concluida", from: 15000 },
];

function statusAt(rec: MockJobRecord, elapsed: number): JobStatus {
  if (rec.willFail && elapsed >= 7000) return "falhou";
  let current: JobStatus = "enviada";
  for (const step of TIMELINE) if (elapsed >= step.from) current = step.status;
  return current;
}

function toJob(rec: MockJobRecord): AnalysisJob {
  const elapsed = Date.now() - rec.createdAt;
  const status = statusAt(rec, elapsed);
  const terminal = status === "concluida" || status === "falhou";
  const created = new Date(rec.createdAt).toISOString();
  return {
    id: rec.id,
    original_filename: rec.filename,
    file_size_bytes: rec.size,
    file_ref: null,
    status,
    error_code: status === "falhou" ? "INVALID_CSV_ENCODING" : null,
    error_message:
      status === "falhou" ? "Codificação inválida detectada na linha 142. Salve o arquivo como UTF-8 e envie novamente." : null,
    created_at: created,
    updated_at: new Date().toISOString(),
    completed_at: terminal ? new Date(rec.createdAt + (status === "falhou" ? 7000 : 15000)).toISOString() : null,
  };
}

export async function mockCreateAnalysis(file: File, signal?: AbortSignal): Promise<AnalysisJob> {
  await mockDelay(MOCK_LATENCY_MS, signal);
  const rec: MockJobRecord = {
    id: crypto.randomUUID(),
    filename: file.name,
    size: file.size,
    createdAt: Date.now(),
    willFail: /falha|erro/i.test(file.name),
  };
  memory[rec.id] = rec;
  saveJobs(memory);
  return toJob(rec);
}

export function mockGetAnalysis(id: string): AnalysisJob {
  return toJob(memory[id]);
}

/* ------------------------------------------------------------------ */
/* Relatorio simulado: base de vendas com e-mails vazios e valores negativos */
/* ------------------------------------------------------------------ */

const ROWS = 104_850;

function numeric(
  nulls: number,
  unique: number,
  stats: Pick<ColumnSummary, "mean" | "std_dev" | "min_value" | "q25" | "median" | "q75" | "max_value">,
): ColumnSummary {
  return {
    data_type: "numeric",
    total_count: ROWS,
    null_count: nulls,
    null_percentage: Number(((nulls / ROWS) * 100).toFixed(2)),
    unique_count: unique,
    ...stats,
  };
}

function categorical(nulls: number, unique: number, top: [string, number][]): ColumnSummary {
  return {
    data_type: "categorical",
    total_count: ROWS,
    null_count: nulls,
    null_percentage: Number(((nulls / ROWS) * 100).toFixed(2)),
    unique_count: unique,
    top_categories: top.map(([category, count]) => ({ category, count })),
  };
}

function temporal(nulls: number, unique: number, min: string, max: string): ColumnSummary {
  return {
    data_type: "temporal",
    total_count: ROWS,
    null_count: nulls,
    null_percentage: Number(((nulls / ROWS) * 100).toFixed(2)),
    unique_count: unique,
    min_value: min,
    max_value: max,
  };
}

export function buildMockDetails(job: AnalysisJob): FullAnalysisDetails {
  const now = new Date().toISOString();
  const analysisId = job.id;

  const profile = {
    id: crypto.randomUUID(),
    analysis_id: analysisId,
    row_count: ROWS,
    column_count: 9,
    generated_at: now,
    columns_summary: {
      id_venda: numeric(0, ROWS - 418, { mean: 52425.5, std_dev: 30267.1, min_value: 1, q25: 26213, median: 52425, q75: 78638, max_value: ROWS }),
      email_cliente: categorical(40_262, 61_904, [
        ["contato@exemplo.com", 212],
        ["vendas@exemplo.com", 187],
        ["cliente@exemplo.com", 164],
      ]),
      valor_total: numeric(420, 18_732, { mean: 284.7, std_dev: 1_912.4, min_value: -1_250.0, q25: 47.9, median: 129.9, q75: 310.0, max_value: 48_950.0 }),
      quantidade: numeric(0, 42, { mean: 2.3, std_dev: 1.8, min_value: 1, q25: 1, median: 2, q75: 3, max_value: 120 }),
      desconto_pct: numeric(2_096, 31, { mean: 6.4, std_dev: 7.1, min_value: 0, q25: 0, median: 5, q75: 10, max_value: 60 }),
      data_venda: temporal(0, 9_840, "2026-01-01", "2026-10-31"),
      uf_destino: categorical(3_250, 27, [["SP", 31_020], ["RJ", 14_880], ["MG", 11_402]]),
      forma_pagamento: categorical(0, 5, [["cartao_credito", 58_110], ["pix", 29_330], ["boleto", 12_048]]),
      codigo_rastreio: categorical(22_940, 81_870, [["SEM_ENTREGA", 1_840]]),
    } satisfies Record<string, ColumnSummary>,
  };

  const finding = (
    code: string,
    severity: QualityFinding["severity"],
    target_column: string | null,
    description: string,
    metric_value: number | null,
    evidence: string | null,
  ): QualityFinding => ({
    id: crypto.randomUUID(),
    analysis_id: analysisId,
    code,
    severity,
    target_column,
    description,
    metric_value,
    evidence,
    created_at: now,
  });

  const findings: QualityFinding[] = [
    finding("CRITICAL_NULL_RATE", "critical", "email_cliente", "38,4% dos registros não possuem e-mail do cliente.", 38.4, "40.262 de 104.850 linhas vazias"),
    finding("NEGATIVE_VALUES", "critical", "valor_total", "Valores negativos em um campo que deveria registrar apenas receita.", 1_137, "Mínimo: -1.250,00 · 1.137 linhas"),
    finding("DUPLICATE_ROWS", "warning", null, "Linhas idênticas em todas as colunas.", 0.4, "418 linhas duplicadas (0,40%)"),
    finding("HIGH_NULL_RATE", "warning", "codigo_rastreio", "21,9% dos pedidos sem código de rastreio.", 21.9, "22.940 linhas vazias"),
    finding("OUTLIER_DETECTED", "info", "valor_total", "Valores acima de 3 desvios-padrão da média.", 96, "Máximo: 48.950,00 · 96 linhas"),
    finding("LOW_CARDINALITY", "info", "forma_pagamento", "Apenas 5 valores distintos; candidata a tipo categórico estrito.", 5, null),
  ];

  const report: QualityReport = {
    id: crypto.randomUUID(),
    analysis_id: analysisId,
    generation_mode: "llm_assisted",
    generated_at: now,
    executive_summary:
      "A base de vendas apresenta consistência estrutural adequada, mas dois problemas comprometem seu uso analítico: 38,4% dos registros não têm e-mail do cliente e 1.137 vendas possuem valor total negativo. Há ainda 418 linhas duplicadas e lacunas relevantes no código de rastreio. Recomenda-se sanear esses pontos antes de qualquer consolidação financeira ou campanha baseada em contato.",
    key_insights: [
      {
        finding_code: "CRITICAL_NULL_RATE",
        interpretation: "A ausência de e-mail inviabiliza campanhas de relacionamento e a deduplicação de clientes por contato.",
        suggested_action: "Tornar o e-mail obrigatório na origem e enriquecer os registros existentes a partir do cadastro.",
      },
      {
        finding_code: "NEGATIVE_VALUES",
        interpretation: "Valores negativos sugerem estornos e devoluções misturados às vendas, distorcendo totais de receita.",
        suggested_action: "Separar estornos em uma coluna ou tabela própria e validar a regra de sinal no ingestor.",
      },
      {
        finding_code: "DUPLICATE_ROWS",
        interpretation: "Duplicidade exata indica retransmissão de eventos de venda.",
        suggested_action: "Aplicar deduplicação por chave natural antes de agregar valores.",
      },
    ],
    recommended_actions: [
      "Corrigir a captura de e-mail na origem",
      "Isolar estornos das vendas",
      "Deduplicar por id_venda",
    ],
    limitations: [
      "As métricas assumem que os valores ausentes são aleatórios (MCAR).",
      "A detecção de outliers usa o critério de 3 desvios-padrão e não considera sazonalidade.",
      "Este relatório é uma simulação de desenvolvimento.",
    ],
  };

  return { job, profile, findings, report };
}

export async function mockGetAnalysisReport(id: string, signal?: AbortSignal): Promise<FullAnalysisDetails> {
  await mockDelay(MOCK_LATENCY_MS, signal);
  return buildMockDetails(mockGetAnalysis(id));
}
