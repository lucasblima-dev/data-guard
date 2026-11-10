import { Cpu, Info, ListChecks, ShieldCheck } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { formatDate, formatTime } from "../../lib/format";
import type { QualityReport } from "../../types/analysis";

/** Resumo executivo, ao lado do hero. */
export function ExecutiveSummary({ report }: { report: QualityReport }) {
  const assisted = report.generation_mode === "llm_assisted";
  return (
    <Card className="flex flex-col gap-4 p-6 xl:col-span-4">
      <h3 className="text-sm font-medium">Resumo executivo</h3>
      <p className="text-sm leading-relaxed text-fg/90">{report.executive_summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-2 text-2xs text-fg-subtle">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-fg-muted">
          {assisted ? (
            <Cpu className="size-3 text-accent-ink" strokeWidth={1.75} />
          ) : (
            <ShieldCheck className="size-3" strokeWidth={1.75} />
          )}
          {assisted ? "Assistido por IA" : "Regras determinísticas"}
        </span>
        <span>
          {formatDate(report.generated_at)} · {formatTime(report.generated_at)}
        </span>
      </div>
    </Card>
  );
}

/** Acoes recomendadas e limitacoes: o fecho do diagnostico. */
export function ReportFooterCards({ report }: { report: QualityReport }) {
  const actions = report.recommended_actions;
  const limits = report.limitations;
  if (actions.length === 0 && limits.length === 0) return null;
  const both = actions.length > 0 && limits.length > 0;

  return (
    <>
      {actions.length > 0 && (
        <Card className={`p-6 ${both ? "xl:col-span-7" : "xl:col-span-12"}`}>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="size-4 text-accent-ink" strokeWidth={1.75} />
            Ações recomendadas
          </h3>
          <ol className="mt-4 space-y-3">
            {actions.map((a, i) => (
              <li key={a} className="flex items-start gap-3 text-sm text-fg-muted">
                <span className="data mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent/10 text-2xs text-accent-ink ring-1 ring-inset ring-accent/20">
                  {i + 1}
                </span>
                {a}
              </li>
            ))}
          </ol>
        </Card>
      )}
      {limits.length > 0 && (
        <Card className={`p-6 ${both ? "xl:col-span-5" : "xl:col-span-12"}`}>
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Info className="size-4 text-fg-subtle" strokeWidth={1.75} />
            Limitações
          </h3>
          <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-fg-muted">
            {limits.map((l) => (
              <li key={l} className="border-l border-line-strong pl-3">
                {l}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
