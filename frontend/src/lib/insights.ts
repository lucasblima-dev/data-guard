import type { KeyInsight, QualityReport } from "../types/analysis";

/** Agrupa os insights do relatorio pelo codigo do achado ao qual se referem. */
export function insightsByCode(report: QualityReport | null | undefined): Map<string, KeyInsight[]> {
  const map = new Map<string, KeyInsight[]>();
  for (const insight of report?.key_insights ?? []) {
    const list = map.get(insight.finding_code) ?? [];
    list.push(insight);
    map.set(insight.finding_code, list);
  }
  return map;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function severityRank(severity: string): number {
  return SEVERITY_ORDER[severity] ?? 3;
}
