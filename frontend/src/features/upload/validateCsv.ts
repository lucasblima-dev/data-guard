/**
 * Limite de upload em MB. O padrao (25) acompanha o MAX_FILE_SIZE_MB do analysis-service;
 * se o backend mudar, ajuste VITE_MAX_UPLOAD_MB.
 */
const envMb = Number(import.meta.env.VITE_MAX_UPLOAD_MB);
export const MAX_CSV_MB = Number.isFinite(envMb) && envMb > 0 ? envMb : 25;
export const MAX_CSV_BYTES = MAX_CSV_MB * 1024 * 1024;

/** Retorna uma mensagem de erro em PT-BR ou null se o arquivo for aceitavel. */
export function validateCsv(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Formato inválido. Envie um arquivo com extensão .csv.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_CSV_BYTES) return `O arquivo excede o limite de ${MAX_CSV_MB} MB.`;
  return null;
}
