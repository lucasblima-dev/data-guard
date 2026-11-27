import type { AnalysisJob, FullAnalysisDetails, JobListResponse, JobStatus } from "../types/analysis";
import { ApiError, apiClient } from "./client";
import {
  isMockJob,
  MOCKS_ENABLED,
  mockCreateAnalysis,
  mockGetAnalysis,
  mockGetAnalysisReport,
  mockListAnalyses,
} from "./mocks";

export interface ListAnalysesParams {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
}

export async function listAnalyses(params: ListAnalysesParams = {}, signal?: AbortSignal): Promise<JobListResponse> {
  if (MOCKS_ENABLED) return mockListAnalyses(params, signal);
  const { data } = await apiClient.get<JobListResponse>("/analyses", {
    params: { page: params.page ?? 1, page_size: params.pageSize ?? 10, status: params.status },
    signal,
  });
  return data;
}

export async function getAnalysis(id: string, signal?: AbortSignal): Promise<AnalysisJob> {
  // Jobs criados pelo mock de upload nao existem no backend: o status e simulado localmente.
  if (MOCKS_ENABLED && isMockJob(id)) return mockGetAnalysis(id);
  const { data } = await apiClient.get<AnalysisJob>(`/analyses/${id}`, { signal });
  return data;
}

/**
 * Cria a análise enviando o arquivo CSV via FormData multipart/form-data
 * para o endpoint POST /api/analyses do analysis-service.
 */
export async function createAnalysis(file: File, signal?: AbortSignal): Promise<AnalysisJob> {
  if (MOCKS_ENABLED) return mockCreateAnalysis(file, signal);

  const formData = new FormData();
  formData.append("file", file, file.name);

  const { data } = await apiClient.post<AnalysisJob>("/analyses", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    // Folga para o "cold start" do plano gratuito (o servico pode levar ~1 min para acordar).
    timeout: UPLOAD_TIMEOUT_MS,
    signal,
  });
  return data;
}

const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Acorda o analysis-service (plano gratuito hiberna por inatividade) sem esperar resposta.
 * Chamado ao abrir a tela de upload, para o envio nao pegar o servico dormindo.
 */
export function wakeBackend(): void {
  if (MOCKS_ENABLED) return;
  const base = apiClient.defaults.baseURL ?? "";
  const origin = base.replace(/\/api\/?$/, "");
  if (!origin) return;
  void fetch(`${origin}/health`, { mode: "no-cors", cache: "no-store" }).catch(() => undefined);
}

/**
 * GET /analyses/{id}/report. Retorna o relatório consolidado com
 * o perfil tabular, achados de qualidade, laudo de IA e health score.
 */
export async function getAnalysisReport(id: string, signal?: AbortSignal): Promise<FullAnalysisDetails | null> {
  if (MOCKS_ENABLED && isMockJob(id)) return mockGetAnalysisReport(id, signal);
  try {
    const { data } = await apiClient.get<FullAnalysisDetails>(`/analyses/${id}/report`, { signal });
    return data;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
}

export interface AnalysesStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
}

/** Estatísticas globais via contagens (page_size=1), sem baixar as listas. */
export async function getAnalysesStats(signal?: AbortSignal): Promise<AnalysesStats> {
  const [all, completed, failed] = await Promise.all([
    listAnalyses({ pageSize: 1 }, signal),
    listAnalyses({ pageSize: 1, status: "concluida" }, signal),
    listAnalyses({ pageSize: 1, status: "falhou" }, signal),
  ]);
  return {
    total: all.total,
    completed: completed.total,
    failed: failed.total,
    inProgress: Math.max(0, all.total - completed.total - failed.total),
  };
}
