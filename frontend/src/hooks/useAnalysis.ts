import { useCallback, useEffect, useState } from "react";
import { getAnalysis } from "../api/analysesApi";
import { ApiError } from "../api/client";
import type { AnalysisJob, JobStatus } from "../types/analysis";

export const POLL_INTERVAL_MS = 3000;

export function isTerminal(status: JobStatus): boolean {
  return status === "concluida" || status === "falhou";
}

/**
 * Consulta o job a cada 3 s e para ao atingir `concluida` ou `falhou`.
 * Falhas transitorias de rede mantem o ultimo estado conhecido e continuam tentando;
 * 404/422 encerram o polling (analise inexistente ou id invalido).
 */
export function useAnalysis(id: string) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const ctrl = new AbortController();

    const load = async () => {
      try {
        const next = await getAnalysis(id, ctrl.signal);
        if (cancelled) return;
        setJob(next);
        setError(null);
        if (!isTerminal(next.status)) timer = window.setTimeout(load, POLL_INTERVAL_MS);
      } catch (e) {
        if (cancelled) return;
        const err = e instanceof ApiError ? e : new ApiError("Erro inesperado.", "UNKNOWN", null);
        if (err.code === "CANCELED") return;
        setError(err);
        const fatal = err.status === 404 || err.status === 422;
        if (!fatal) timer = window.setTimeout(load, POLL_INTERVAL_MS);
      }
    };

    void load();
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { job, error, retry };
}
