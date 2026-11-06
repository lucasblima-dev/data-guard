import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Inbox, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useAnalysesList } from "../../hooks/useAnalysesList";
import { tweenSnap } from "../../lib/motion";
import { jobStatusMeta } from "../../lib/status";
import type { JobStatus } from "../../types/analysis";
import { HistoryTable } from "./HistoryTable";
import { StatsRow } from "./StatsRow";

const filters: { value: JobStatus | undefined; label: string }[] = [
  { value: undefined, label: "Todas" },
  ...(Object.entries(jobStatusMeta) as [JobStatus, { label: string }][]).map(([value, m]) => ({
    value,
    label: m.label,
  })),
];

function SkeletonRows() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-5">
          <div className="size-9 animate-pulse-soft rounded-xl bg-fg/8" />
          <div className="h-4 w-48 animate-pulse-soft rounded bg-fg/8" />
          <div className="hidden h-4 w-28 animate-pulse-soft rounded bg-fg/8 sm:block" />
          <div className="ml-auto h-4 w-20 animate-pulse-soft rounded bg-fg/8" />
        </div>
      ))}
    </div>
  );
}

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobStatus | undefined>();
  const [query, setQuery] = useState("");
  const { data, stats, loading, error, retry } = useAnalysesList(page, status);

  // O backend nao expoe busca por nome: filtra apenas a pagina carregada.
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = data?.items ?? [];
    return q ? all.filter((j) => j.original_filename.toLowerCase().includes(q)) : all;
  }, [data, query]);

  const totalPages = data?.total_pages ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="auditorias"
        title="Histórico"
        description="Todas as auditorias de dados enviadas e o estado de cada uma."
      />

      <StatsRow stats={stats} unavailable={!stats && !loading && error !== null} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-fg/[0.03] px-3.5 focus-within:border-line-strong lg:w-72">
            <Search className="size-3.5 text-fg-subtle" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por arquivo"
              aria-label="Buscar por arquivo"
              className="w-full bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            />
          </label>

          <div
            role="group"
            aria-label="Filtrar por status"
            className="flex max-w-full gap-0.5 overflow-x-auto rounded-full border border-line bg-fg/[0.03] p-1"
          >
            {filters.map((f) => {
              const active = f.value === status;
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => {
                    setStatus(f.value);
                    setPage(1);
                  }}
                  aria-pressed={active}
                  className={`focus-ring relative h-7 shrink-0 rounded-full px-3 text-xs font-medium transition-colors duration-150 ${
                    active ? "text-accent-fg" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="status-chip"
                      transition={tweenSnap}
                      className="absolute inset-0 rounded-full bg-accent"
                    />
                  )}
                  <span className="relative">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-line">
          {loading && !data ? (
            <SkeletonRows />
          ) : error && !data ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <TriangleAlert className="size-5 text-warn" strokeWidth={1.5} />
              <p className="max-w-sm text-sm text-fg-muted">{error.message}</p>
              <Button onClick={retry}>Tentar novamente</Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
              <Inbox className="size-5 text-fg-subtle" strokeWidth={1.5} />
              <p className="text-sm text-fg-muted">
                {query || status ? "Nenhuma auditoria encontrada com esses filtros." : "Nenhuma auditoria enviada ainda."}
              </p>
              {!query && !status && (
                <Link to="/upload" className="text-sm text-accent-ink hover:underline">
                  Enviar o primeiro CSV
                </Link>
              )}
            </div>
          ) : (
            <HistoryTable key={`${page}-${status ?? "all"}`} items={items} />
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-fg-subtle">
            <span className="data">
              página {data?.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="glass" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-3.5" strokeWidth={1.75} />
                Anterior
              </Button>
              <Button variant="glass" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próximo
                <ChevronRight className="size-3.5" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
