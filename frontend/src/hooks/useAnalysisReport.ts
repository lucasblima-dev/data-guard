import { useCallback, useEffect, useState } from "react";
import { getAnalysisReport } from "../api/analysesApi";
import { ApiError } from "../api/client";
import type { FullAnalysisDetails } from "../types/analysis";

interface State {
  details: FullAnalysisDetails | null;
  loading: boolean;
  error: ApiError | null;
}

/** Carrega o relatorio completo uma unica vez, quando a analise esta concluida. */
export function useAnalysisReport(id: string, enabled: boolean) {
  const [state, setState] = useState<State>({ details: null, loading: false, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setState({ details: null, loading: true, error: null });
    getAnalysisReport(id, ctrl.signal)
      .then((details) => setState({ details, loading: false, error: null }))
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.code === "CANCELED") return;
        const error = e instanceof ApiError ? e : new ApiError("Erro inesperado.", "UNKNOWN", null);
        setState({ details: null, loading: false, error });
      });
    return () => ctrl.abort();
  }, [id, enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
