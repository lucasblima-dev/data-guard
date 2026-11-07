export const MAX_CSV_BYTES = 100 * 1024 * 1024;

/** Retorna uma mensagem de erro em PT-BR ou null se o arquivo for aceitavel. */
export function validateCsv(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) return "Formato inválido. Envie um arquivo com extensão .csv.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_CSV_BYTES) return "O arquivo excede o limite de 100 MB.";
  return null;
}
