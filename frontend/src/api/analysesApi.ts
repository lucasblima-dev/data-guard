import type { AnalysisJob, JobListResponse, JobStatus } from "../types/analysis";
import { apiClient } from "./client";

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
  const { data } = await apiClient.get<AnalysisJob>(`/analyses/${id}`, { signal });
  return data;
}

/**
 * Cria a analise (POST /analyses -> 201). O analysis-service expoe hoje apenas o
 * registro de metadados em JSON; o envio do binario (multipart) deve entrar aqui,
 * neste unico ponto, quando o endpoint de upload existir.
 */
export async function createAnalysis(file: File, signal?: AbortSignal): Promise<AnalysisJob> {
  const { data } = await apiClient.post<AnalysisJob>(
    "/analyses",
    { original_filename: file.name, file_size_bytes: file.size },
    { signal },
  );
  return data;
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
