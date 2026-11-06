import type { JobStatus } from "../types";

export type Tone = "ok" | "warn" | "danger" | "info" | "progress" | "neutral";

/** Mapeia o enum JobStatus (analysis-service) para tom visual e rotulo PT-BR. */
export const jobStatusMeta: Record<JobStatus, { label: string; tone: Tone; active: boolean }> = {
  enviada: { label: "Enviada", tone: "neutral", active: true },
  validando: { label: "Validando", tone: "warn", active: true },
  analisando: { label: "Analisando", tone: "info", active: true },
  gerando_relatorio: { label: "Gerando relatório", tone: "progress", active: true },
  concluida: { label: "Concluída", tone: "ok", active: false },
  falhou: { label: "Falhou", tone: "danger", active: false },
};

/** Severidades do data-quality-service: info | warning | critical. */
export const severityMeta: Record<string, { label: string; tone: Tone }> = {
  info: { label: "Informativo", tone: "info" },
  warning: { label: "Atenção", tone: "warn" },
  critical: { label: "Crítico", tone: "danger" },
};

/** Classes por tom: texto, fundo translucido e borda fina de baixo contraste. */
export const toneClasses: Record<Tone, { text: string; bg: string; border: string; dot: string }> = {
  ok: { text: "text-ok", bg: "bg-ok/10", border: "border-ok/20", dot: "bg-ok" },
  warn: { text: "text-warn", bg: "bg-warn/10", border: "border-warn/20", dot: "bg-warn" },
  danger: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/20", dot: "bg-danger" },
  info: { text: "text-info", bg: "bg-info/10", border: "border-info/20", dot: "bg-info" },
  progress: { text: "text-progress", bg: "bg-progress/10", border: "border-progress/20", dot: "bg-progress" },
  neutral: { text: "text-fg-muted", bg: "bg-fg/5", border: "border-line", dot: "bg-fg-subtle" },
};
