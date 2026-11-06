import type { ReactNode } from "react";
import { toneClasses, type Tone } from "../../lib/status";

interface BadgeProps {
  tone?: Tone;
  /** Ponto com "ping" para estados em andamento. */
  live?: boolean;
  children: ReactNode;
}

export function Badge({ tone = "neutral", live = false, children }: BadgeProps) {
  const t = toneClasses[tone];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium ${t.text}`}>
      <span className="relative flex size-2">
        {live && (
          <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${t.dot}`} />
        )}
        <span className={`relative inline-flex size-2 rounded-full ${t.dot}`} />
      </span>
      {children}
    </span>
  );
}
