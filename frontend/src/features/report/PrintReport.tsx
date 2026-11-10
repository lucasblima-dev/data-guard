import { createPortal } from "react-dom";
import { LogoMark } from "../../components/brand/Logo";
import { formatBytes } from "../../lib/format";
import { insightsByCode, severityRank } from "../../lib/insights";
import { nullBucket, TYPE_LABELS } from "../../lib/quality";
import { severityMeta } from "../../lib/status";
import type { AnalysisJob, ColumnSummary, FullAnalysisDetails } from "../../types/analysis";
import "./print.css";

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });
const nf = new Intl.NumberFormat("pt-BR");
const nf2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const BAR_COLOR = { clean: "transparent", low: "#9bc400", mid: "#c77700", high: "#c92a2a" } as const;

function fmtValue(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return nf2.format(v);
  return v.length > 22 ? `${v.slice(0, 21)}…` : v;
}

function PrintRing({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="pr-ring">
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#11150a"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
        />
      </svg>
      <div className="pr-ring-center">
        <strong>{v}</strong>
        <span>saúde do dataset</span>
      </div>
    </div>
  );
}

function PageHead({ filename }: { filename: string }) {
  return (
    <header className="pr-head">
      <span className="pr-head-brand">
        <LogoMark className="" />
        DataGuard
      </span>
      <span className="pr-mono">{filename}</span>
    </header>
  );
}

interface Props {
  job: AnalysisJob;
  details: FullAnalysisDetails;
}

/**
 * Documento impresso (somente visivel ao imprimir): capa, sumario executivo,
 * achados, perfil das colunas e fecho com acoes, limitacoes e metodologia.
 */
export function PrintReport({ job, details }: Props) {
  const { profile, report } = details;
  if (!profile) return null;

  const findings = [...(details.findings ?? [])].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const insights = insightsByCode(report);
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warning = findings.filter((f) => f.severity === "warning").length;
  const score = details.health_score ?? null;
  const columns = Object.entries(profile.columns_summary) as [string, ColumnSummary][];
  const assisted = report?.generation_mode === "llm_assisted";
  const emitted = longDate.format(new Date());

  const document_ = (
    <div className="pr-root" aria-hidden>
      {/* ---------------- Capa ---------------- */}
      <section className="pr-cover">
        <div className="pr-brand">
          <span className="pr-brand-lockup">
            <LogoMark className="" />
            <span>
              Data<b>Guard</b>
            </span>
          </span>
          <span className="pr-tag pr-mono">Relatório</span>
        </div>

        <div className="pr-cover-title">
          <p className="pr-eyebrow pr-mono">Auditoria de dados tabulares</p>
          <h1 className="pr-h1">Relatório de Qualidade de Dados</h1>
          <p className="pr-file pr-mono">{job.original_filename}</p>
        </div>

        <div className="pr-hero">
          <div>
            <p className="pr-hero-label">Registros analisados</p>
            <p className="pr-hero-num">{nf.format(profile.row_count)}</p>
            <div className="pr-chips">
              <span>{profile.column_count} colunas</span>
              <span>{critical} críticos</span>
              <span>{warning} atenção</span>
            </div>
          </div>
          {score !== null && <PrintRing value={score} />}
        </div>

        <dl className="pr-meta">
          <div>
            <dt className="pr-mono">Arquivo analisado</dt>
            <dd>{job.original_filename}</dd>
          </div>
          <div>
            <dt className="pr-mono">Identificador da análise</dt>
            <dd className="pr-mono" style={{ fontSize: "8.5pt" }}>
              {job.id}
            </dd>
          </div>
          <div>
            <dt className="pr-mono">Análise realizada em</dt>
            <dd>{longDate.format(new Date(job.created_at))}</dd>
          </div>
          <div>
            <dt className="pr-mono">Relatório emitido em</dt>
            <dd>{emitted}</dd>
          </div>
          <div>
            <dt className="pr-mono">Tamanho do arquivo</dt>
            <dd>{formatBytes(job.file_size_bytes)}</dd>
          </div>
          <div>
            <dt className="pr-mono">Redação do relatório</dt>
            <dd>{report ? (assisted ? "Assistida por IA" : "Regras determinísticas") : "Não disponível"}</dd>
          </div>
        </dl>
        <p className="pr-disclaimer">
          Documento gerado automaticamente pelo DataGuard. Todas as métricas são calculadas de forma determinística
          sobre o arquivo enviado; a inteligência artificial, quando utilizada, atua apenas na redação do texto.
        </p>
      </section>

      {/* ---------------- Sumario executivo ---------------- */}
      <section className="pr-page">
        <PageHead filename={job.original_filename} />
        <h2 className="pr-h2">Sumário executivo</h2>
        <p className="pr-sub">Visão geral da qualidade do conjunto de dados analisado.</p>

        <div className="pr-stats">
          <div className="pr-stat lime">
            <div className="pr-stat-l">Registros</div>
            <div className="pr-stat-v pr-mono">{nf.format(profile.row_count)}</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-l">Colunas</div>
            <div className="pr-stat-v pr-mono">{profile.column_count}</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-l">Saúde do dataset</div>
            <div className="pr-stat-v pr-mono">{score !== null ? `${score}/100` : "—"}</div>
          </div>
          <div className="pr-stat">
            <div className="pr-stat-l">Achados</div>
            <div className="pr-stat-v pr-mono">{findings.length}</div>
          </div>
        </div>

        {report ? (
          <p className="pr-p">{report.executive_summary}</p>
        ) : (
          <p className="pr-p">O resumo executivo não está disponível para esta análise.</p>
        )}

        {findings.length > 0 && (
          <>
            <h3 className="pr-h3">Distribuição dos achados</h3>
            <p className="pr-p" style={{ fontSize: "9.5pt", marginBottom: 0 }}>
              {critical} crítico(s), {warning} de atenção e {findings.length - critical - warning} informativo(s). Os
              detalhes de cada achado, com interpretação e ação sugerida, estão na próxima seção.
            </p>
          </>
        )}
      </section>

      {/* ---------------- Achados ---------------- */}
      <section className="pr-page">
        <PageHead filename={job.original_filename} />
        <h2 className="pr-h2">Achados de qualidade</h2>
        <p className="pr-sub">Ordenados por severidade, com a interpretação e a ação sugerida quando disponíveis.</p>

        {findings.length === 0 && <p className="pr-p">Nenhum problema de qualidade foi detectado.</p>}
        {findings.map((f) => {
          const meta = severityMeta[f.severity];
          return (
            <article key={f.id} className="pr-finding">
              <div className="pr-finding-top">
                <span className="pr-code pr-mono">{f.code}</span>
                <span className={`pr-sev ${f.severity}`}>{meta?.label ?? f.severity}</span>
              </div>
              {f.target_column && <p className="pr-col pr-mono">{f.target_column}</p>}
              <p className="pr-desc">{f.description}</p>
              {f.evidence && <p className="pr-ev pr-mono">{f.evidence}</p>}
              {(insights.get(f.code) ?? []).map((i) => (
                <div key={i.interpretation}>
                  <p className="pr-interp">{i.interpretation}</p>
                  <div className="pr-action">
                    <b className="pr-mono">Ação sugerida</b>
                    {i.suggested_action}
                  </div>
                </div>
              ))}
            </article>
          );
        })}
      </section>

      {/* ---------------- Perfil das colunas ---------------- */}
      <section className="pr-page">
        <PageHead filename={job.original_filename} />
        <h2 className="pr-h2">Perfil das colunas</h2>
        <p className="pr-sub">Tipo inferido, taxa de valores ausentes e estatísticas básicas de cada coluna.</p>

        <table className="pr-table">
          <thead>
            <tr>
              <th>Coluna</th>
              <th>Tipo</th>
              <th>Nulos</th>
              <th className="num">Únicos</th>
              <th className="num">Mínimo</th>
              <th className="num">Máximo</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(([name, col]) => {
              const bucket = nullBucket(col.null_percentage);
              return (
                <tr key={name}>
                  <td className="pr-mono" style={{ fontSize: "8pt" }}>
                    {name}
                  </td>
                  <td>{TYPE_LABELS[col.data_type] ?? col.data_type}</td>
                  <td>
                    <span className="pr-bar">
                      <i style={{ width: `${Math.min(100, col.null_percentage)}%`, background: BAR_COLOR[bucket] }} />
                    </span>
                    <span className="pr-mono">{nf2.format(col.null_percentage)}%</span>
                  </td>
                  <td className="num pr-mono">{nf.format(col.unique_count)}</td>
                  <td className="num pr-mono">{fmtValue(col.min_value)}</td>
                  <td className="num pr-mono">{fmtValue(col.max_value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* ---------------- Fecho ---------------- */}
      <section className="pr-page">
        <PageHead filename={job.original_filename} />
        <h2 className="pr-h2">Ações e ressalvas</h2>
        <p className="pr-sub">Próximos passos recomendados e limites desta análise.</p>

        {report && report.recommended_actions.length > 0 && (
          <>
            <h3 className="pr-h3" style={{ marginTop: 0 }}>
              Ações recomendadas
            </h3>
            <ol className="pr-list">
              {report.recommended_actions.map((a, i) => (
                <li key={a}>
                  <span className="n pr-mono">{i + 1}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </>
        )}

        {report && report.limitations.length > 0 && (
          <>
            <h3 className="pr-h3">Limitações</h3>
            <ul className="pr-list">
              {report.limitations.map((l) => (
                <li key={l}>
                  <span className="n dot" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="pr-h3">Metodologia</h3>
        <p className="pr-note">
          O perfilamento (contagens, nulos, duplicidades, distribuições e achados) é executado por código determinístico
          com Pandas e NumPy, sem uso de modelos de linguagem para qualquer cálculo. Quando a redação assistida por IA
          está ativa, o modelo recebe apenas as métricas agregadas e os achados, nunca o arquivo original, e é
          responsável somente pelo resumo e pelas sugestões de investigação.
        </p>
      </section>
    </div>
  );

  return createPortal(document_, document.body);
}
