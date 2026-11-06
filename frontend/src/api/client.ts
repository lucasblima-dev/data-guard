import axios, { AxiosError } from "axios";

/** Erro normalizado: a UI nunca ve stack traces nem payloads crus. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;

  constructor(message: string, code: string, status: number | null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface BackendErrorBody {
  detail?: { code?: string; message?: string } | string;
}

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) return new ApiError("Erro inesperado.", "UNKNOWN", null);
  const err = error as AxiosError<BackendErrorBody>;

  if (err.code === "ERR_CANCELED") return new ApiError("Requisição cancelada.", "CANCELED", null);
  if (!err.response) {
    return new ApiError(
      "Não foi possível se comunicar com o serviço de análise. Tente novamente em instantes.",
      "NETWORK_ERROR",
      null,
    );
  }

  const detail = err.response.data?.detail;
  if (detail && typeof detail === "object" && detail.message) {
    return new ApiError(detail.message, detail.code ?? "API_ERROR", err.response.status);
  }
  if (err.response.status === 503) {
    return new ApiError("Serviço temporariamente indisponível.", "SERVICE_UNAVAILABLE", 503);
  }
  return new ApiError("A requisição não pôde ser concluída.", "API_ERROR", err.response.status);
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 10_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);
