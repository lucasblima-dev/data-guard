/**
 * DataGuard - Tipos TypeScript para Relatório Executivo e Síntese de IA
 * Mapeado a partir das diretrizes de AGENTS.md e FRONTEND.md
 */

import { AnalysisJob } from "./job";
import { DatasetProfile, QualityFinding } from "./quality";

/**
 * Modo de geração do relatório analítico
 * - llm_assisted: Gerado com apoio de inferência de IA (Hugging Face ou Ollama local)
 * - rules_only: Gerado via motor determinístico de regras heurísticas locais
 */
export type ReportGenerationMode = "llm_assisted" | "rules_only";

/**
 * Item individual de insight analítico contextual
 */
export interface KeyInsight {
  finding_code: string;
  interpretation: string;
  suggested_action: string;
}

/**
 * Relatório consolidado de qualidade e auditoria (QualityReport / AnalysisReport)
 */
export interface QualityReport {
  id: string; // UUID v4
  analysis_id: string; // UUID v4
  executive_summary: string;
  key_insights: KeyInsight[];
  recommended_actions: string[];
  limitations: string[];
  generation_mode: ReportGenerationMode;
  generated_at: string; // ISO 8601
}

/**
 * Alias semântico para AnalysisReport
 */
export type AnalysisReport = QualityReport;

/**
 * Resposta agregada para o Dashboard Completo (Job + Profile + Findings + Report)
 */
export interface FullAnalysisDetails {
  job: AnalysisJob;
  profile?: DatasetProfile | null;
  findings?: QualityFinding[];
  report?: QualityReport | null;
}
