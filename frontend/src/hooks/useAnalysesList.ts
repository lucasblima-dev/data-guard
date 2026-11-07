import { useCallback, useEffect, useState } from "react";
import { getAnalysesStats, listAnalyses, type AnalysesStats } from "../api/analysesApi";
import { ApiError } from "../api/client";
import { jobStatusMeta } from "../lib/status";
import type { JobListResponse, JobStatus } from "../types/analysis";

const POLL_MS = 3000;

interface State {
  data: JobListResponse | null;
  stats: AnalysesStats | null;
  loading: boolean;
  error: ApiError | null;
}

/** Lista paginada com filtro; refaz a consulta a cada 3 s enquanto houver job em andamento. */
export function useAnalysesList(page: number, status: JobStatus | undefined, pageSize = 10) {
  const [state, setState] = useState<State>({ data: null, stats: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([listAnalyses({ page, pageSize, status }, ctrl.signal), getAnalysesStats(ctrl.signal)])
      .then(([data, stats]) => setState({ data, stats, loading: false, error: null }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === "CANCELED") return;
        const error = e instanceof ApiError ? e : new ApiError("Erro inesperado.", "UNKNOWN", null);
        setState((prev) => ({ ...prev, loading: false, error }));
      });
    return () => ctrl.abort();
  }, [page, status, pageSize, tick]);

  const hasActive = state.data?.items.some((j) => jobStatusMeta[j.status].active) ?? false;
  useEffect(() => {
    if (!hasActive) return;
    const id = window.setTimeout(() => setTick((t) => t + 1), POLL_MS);
    return () => window.clearTimeout(id);
  }, [hasActive, state.data]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    setTick((t) => t + 1);
  }, []);

  return { ...state, retry };
}
