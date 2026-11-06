import type { AnalysisJob, FullAnalysisDetails, JobListResponse, JobStatus } from "../types/analysis";
import { ApiError, apiClient } from "./client";
import {
  isMockJob,
  MOCKS_ENABLED,
  mockCreateAnalysis,
  mockGetAnalysis,
  mockGetAnalysisReport,
} from "./mocks";

export interface ListAnalysesParams {
  page?: number;
  pageSize?: number;
  status?: JobStatus;
}

export async function listAnalyses(params: ListAnalysesParams = {}, signal?: AbortSignal): Promise<JobListResponse> {
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
 * Cria a analise (POST /analyses -> 201). O analysis-service expoe hoje apenas o
 * registro de metadados em JSON; o envio do binario (multipart) deve entrar aqui,
 * neste unico ponto, quando o endpoint de upload existir.
 */
export async function createAnalysis(file: File, signal?: AbortSignal): Promise<AnalysisJob> {
  if (MOCKS_ENABLED) return mockCreateAnalysis(file, signal); // simulado: espera 2 s, sem chamada HTTP
  const { data } = await apiClient.post<AnalysisJob>(
    "/analyses",
    { original_filename: file.name, file_size_bytes: file.size },
    { signal },
  );
  return data;
}

/**
 * GET /analyses/{id}/report. Retorna null quando o servico ainda nao expoe o
 * relatorio (404/405), para a UI degradar sem tratar como falha.
 */
export async function getAnalysisReport(id: string, signal?: AbortSignal): Promise<FullAnalysisDetails | null> {
  if (MOCKS_ENABLED && isMockJob(id)) return mockGetAnalysisReport(id, signal); // simulado: espera 2 s
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

/** Estatisticas globais via contagens (page_size=1), sem baixar as listas. */
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
