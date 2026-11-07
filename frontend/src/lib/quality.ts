/** Faixas de taxa de nulos usadas no mapa do dataset e no grafico. */
export type NullBucket = "clean" | "low" | "mid" | "high";

export function nullBucket(pct: number): NullBucket {
  if (pct === 0) return "clean";
  if (pct <= 10) return "low";
  if (pct <= 30) return "mid";
  return "high";
}

/** Classes de celula (mapa do dataset). */
export const bucketCell: Record<NullBucket, string> = {
  clean: "bg-accent",
  low: "bg-accent/45",
  mid: "bg-warn",
  high: "bg-danger",
};

/** Cores CSS para o grafico (SVG). */
export const bucketColor: Record<NullBucket, string> = {
  clean: "var(--color-accent)",
  low: "color-mix(in oklab, var(--color-accent) 55%, transparent)",
  mid: "var(--color-warn)",
  high: "var(--color-danger)",
};

export const bucketLabel: Record<NullBucket, string> = {
  clean: "sem nulos",
  low: "até 10%",
  mid: "10 a 30%",
  high: "acima de 30%",
};

export const TYPE_LABELS: Record<string, string> = {
  numeric: "Numérico",
  categorical: "Categórico",
  temporal: "Temporal",
  textual: "Textual",
};
