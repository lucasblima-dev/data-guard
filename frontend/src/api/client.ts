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

/** Mensagens amigaveis por status HTTP, usadas quando o backend nao envia `detail.message`. */
function fromStatus(status: number): { code: string; message: string } {
  switch (status) {
    case 400:
      return { code: "INVALID_REQUEST", message: "A requisição é inválida. Verifique o arquivo e tente novamente." };
    case 404:
      return { code: "NOT_FOUND", message: "O recurso solicitado não foi encontrado." };
    case 413:
      return { code: "FILE_TOO_LARGE", message: "O arquivo excede o tamanho máximo permitido." };
    case 415:
      return { code: "UNSUPPORTED_MEDIA_TYPE", message: "Formato não suportado. Envie um arquivo CSV." };
    case 422:
      return { code: "VALIDATION_ERROR", message: "Os dados enviados são inválidos." };
    case 429:
      return { code: "RATE_LIMITED", message: "Muitas requisições. Aguarde alguns instantes e tente novamente." };
    case 502:
    case 503:
    case 504:
      return {
        code: "SERVICE_UNAVAILABLE",
        message: "Serviço temporariamente indisponível. Tente novamente em instantes.",
      };
    default:
      if (status >= 500) {
        return { code: "SERVER_ERROR", message: "Erro interno no serviço de análise. Tente novamente mais tarde." };
      }
      return { code: "API_ERROR", message: "A requisição não pôde ser concluída." };
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Não foi possível se comunicar com o serviço de análise. Verifique sua conexão e tente novamente.";
export const TIMEOUT_ERROR_MESSAGE = "O serviço demorou demais para responder. Tente novamente em instantes.";

/** Cria o erro normalizado correspondente a um status HTTP (usado tambem pelos mocks). */
export function apiErrorFromStatus(status: number): ApiError {
  const { code, message } = fromStatus(status);
  return new ApiError(message, code, status);
}

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) return new ApiError("Erro inesperado.", "UNKNOWN", null);
  const err = error as AxiosError<BackendErrorBody>;

  if (err.code === "ERR_CANCELED") return new ApiError("Requisição cancelada.", "CANCELED", null);
  if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
    return new ApiError(TIMEOUT_ERROR_MESSAGE, "TIMEOUT", null);
  }
  if (!err.response) return new ApiError(NETWORK_ERROR_MESSAGE, "NETWORK_ERROR", null);

  const status = err.response.status;
  const detail = err.response.data?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail) && detail.message) {
    return new ApiError(detail.message, detail.code ?? fromStatus(status).code, status);
  }
  return apiErrorFromStatus(status);
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  timeout: 30_000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);
