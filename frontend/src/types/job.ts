/**
 * DataGuard - Tipos TypeScript para Análises e Jobs
 * Mapeado a partir de: services/analysis-service/app/schemas/job.py
 */

/**
 * Status do ciclo de vida de uma análise no DataGuard
 */
export type JobStatus =
  | "enviada"
  | "validando"
  | "analisando"
  | "gerando_relatorio"
  | "concluida"
  | "falhou";

/**
 * Constante auxiliar para verificação e comparação de status
 */
export const JobStatusEnum = {
  ENVIADA: "enviada",
  VALIDANDO: "validando",
  ANALISANDO: "analisando",
  GERANDO_RELATORIO: "gerando_relatorio",
  CONCLUIDA: "concluida",
  FALHOU: "falhou",
} as const;

/**
 * Modelo central de AnalysisJob (espelha JobResponse do backend)
 */
export interface AnalysisJob {
  id: string; // UUID v4
  original_filename: string;
  file_size_bytes: number | null;
  file_ref: string | null;
  status: JobStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  completed_at: string | null; // ISO 8601
}

/**
 * Alias semântico para JobResponse
 */
export type JobResponse = AnalysisJob;

/**
 * Payload para criação de uma nova análise (JobCreate)
 */
export interface JobCreate {
  original_filename: string;
  file_size_bytes?: number | null;
  file_ref?: string | null;
}

/**
 * Alias para compatibilidade com nomenclaturas de payload
 */
export type JobCreatePayload = JobCreate;

/**
 * Payload para atualização parcial de uma análise (JobUpdate)
 */
export interface JobUpdate {
  status?: JobStatus | null;
  error_code?: string | null;
  error_message?: string | null;
  completed_at?: string | null;
}

/**
 * Alias para compatibilidade
 */
export type JobUpdatePayload = JobUpdate;

/**
 * Resposta paginada de listagem de jobs (JobListResponse)
 */
export interface JobListResponse {
  items: AnalysisJob[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
