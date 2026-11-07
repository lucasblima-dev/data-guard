/**
 * DataGuard - Tipos TypeScript para Perfilamento e Qualidade de Dados
 * Mapeado a partir de: services/data-quality-service/app/schemas/quality.py
 */

/**
 * Tipos de dados inferidos para colunas pelo profiler
 */
export type ColumnDataType = "numeric" | "categorical" | "temporal" | "textual";

/**
 * Estrutura para contagem das principais categorias de uma coluna
 */
export interface TopCategory {
  category: string;
  count: number;
}

/**
 * Resumo estatístico descritivo de uma coluna tabular (ColumnSummary)
 */
export interface ColumnSummary {
  data_type: ColumnDataType | string;
  total_count: number;
  null_count: number;
  null_percentage: number;
  unique_count: number;
  mean?: number | null;
  std_dev?: number | null;
  min_value?: number | string | null;
  q25?: number | null;
  median?: number | null;
  q75?: number | null;
  max_value?: number | string | null;
  top_categories?: TopCategory[] | null;
}

/**
 * Níveis de severidade para achados de conformidade e qualidade
 */
export type FindingSeverity = "info" | "warning" | "critical";

/**
 * Achado/Violação de conformidade de dados (QualityFindingResponse)
 */
export interface QualityFinding {
  id: string; // UUID v4
  analysis_id: string; // UUID v4
  code: string; // Ex: 'DUPLICATE_ROWS', 'CRITICAL_NULL_RATE', etc.
  severity: FindingSeverity;
  target_column: string | null;
  description: string;
  metric_value: number | null;
  evidence: string | null;
  created_at: string; // ISO 8601
}

/**
 * Alias semântico para QualityFindingResponse
 */
export type QualityFindingResponse = QualityFinding;

/**
 * Perfil estatístico tabular completo gerado para a análise (DatasetProfileResponse)
 */
export interface DatasetProfile {
  id: string; // UUID v4
  analysis_id: string; // UUID v4
  row_count: number;
  column_count: number;
  columns_summary: Record<string, ColumnSummary>;
  generated_at: string; // ISO 8601
}

/**
 * Alias semântico para DatasetProfileResponse
 */
export type DatasetProfileResponse = DatasetProfile;

/**
 * Resposta agregada contendo perfil e lista de achados (QualityDetailsResponse)
 */
export interface QualityDetailsResponse {
  analysis_id: string; // UUID v4
  profile: DatasetProfile | null;
  findings: QualityFinding[];
}

/**
 * Payload de requisição para acionamento do motor analítico (ProcessQualityRequest)
 */
export interface ProcessQualityRequest {
  analysis_id: string; // UUID v4
  filename: string;
  file_ref?: string | null;
}

/**
 * Resposta do motor analítico ao processar qualidade (ProcessQualityResponse)
 */
export interface ProcessQualityResponse {
  analysis_id: string; // UUID v4
  status: string;
  message: string;
  profile_id: string | null; // UUID v4
  findings_count: number;
}
