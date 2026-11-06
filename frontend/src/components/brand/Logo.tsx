/**
 * Marca do DataGuard: escudo preenchido por uma grade 3x3 de celulas de dados,
 * com uma celula sinalizada (a anomalia que o produto encontra).
 */
export function LogoMark({ className = "size-5" }: { className?: string }) {
  const cell = 2.4;
  const gap = 1.1;
  const start = 12 - (3 * cell + 2 * gap) / 2;
  const cells = Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3);
    const c = i % 3;
    return { key: i, x: start + c * (cell + gap), y: 6.8 + r * (cell + gap), flagged: i === 2 };
  });

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2.5 20 5.5v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10v-6L12 2.5Z"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {cells.map((c) => (
        <rect
          key={c.key}
          x={c.x}
          y={c.y}
          width={cell}
          height={cell}
          rx="0.5"
          fill={c.flagged ? "var(--color-accent)" : "currentColor"}
          fillOpacity={c.flagged ? 1 : 0.28}
        />
      ))}
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark className="size-[18px] text-fg" />
      <span className="text-sm font-semibold tracking-tight">
        Data<span className="text-accent">Guard</span>
      </span>
    </span>
  );
}
