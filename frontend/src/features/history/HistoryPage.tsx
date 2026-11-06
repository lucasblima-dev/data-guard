import { ChevronLeft, ChevronRight, Inbox, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { useAnalysesList } from "../../hooks/useAnalysesList";
import { jobStatusMeta } from "../../lib/status";
import type { JobStatus } from "../../types/analysis";
import { HistoryTable } from "./HistoryTable";
import { StatsRow } from "./StatsRow";

const statusOptions = Object.entries(jobStatusMeta) as [JobStatus, { label: string }][];

function SkeletonRows() {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-5">
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
    <div className="space-y-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tighter">Histórico</h1>
        <p className="text-sm text-fg-muted">Todas as auditorias de dados enviadas e o estado de cada uma.</p>
      </div>

      <StatsRow stats={stats} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="glass relative flex h-9 items-center gap-2 rounded-control px-3 focus-within:border-line-strong sm:w-72">
            <Search className="size-3.5 text-fg-subtle" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por arquivo"
              aria-label="Buscar por arquivo"
              className="w-full bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            />
          </label>
          <select
            value={status ?? ""}
            onChange={(e) => {
              setStatus((e.target.value || undefined) as JobStatus | undefined);
              setPage(1);
            }}
            aria-label="Filtrar por status"
            className="glass focus-ring h-9 rounded-control px-3 text-sm text-fg-muted outline-none"
          >
            <option value="">Todos os status</option>
            {statusOptions.map(([value, m]) => (
              <option key={value} value={value} className="bg-surface-solid">
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <Card className="overflow-hidden">
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
                <Link to="/upload" className="text-sm text-accent hover:underline">
                  Enviar o primeiro CSV
                </Link>
              )}
            </div>
          ) : (
            <HistoryTable key={`${page}-${status ?? "all"}`} items={items} />
          )}
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span className="tabular-nums">
              Página {data?.page} de {totalPages}
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
      </section>
    </div>
  );
}
