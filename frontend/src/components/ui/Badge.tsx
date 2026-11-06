import type { ReactNode } from "react";
import { toneClasses, type Tone } from "../../lib/status";

interface BadgeProps {
  tone?: Tone;
  /** Ponto com "ping" para estados em andamento. */
  live?: boolean;
  children: ReactNode;
}

/** Pilula de status: ponto (pulsante se `live`) + rotulo, com fundo translucido. */
export function Badge({ tone = "neutral", live = false, children }: BadgeProps) {
  const t = toneClasses[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-2xs font-medium ${t.text} ${t.bg} ${t.border}`}
    >
      <span className="relative flex size-1.5">
        {live && (
          <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-70 ${t.dot}`} />
        )}
        <span className={`relative inline-flex size-1.5 rounded-full ${t.dot}`} />
      </span>
      {children}
    </span>
  );
}
