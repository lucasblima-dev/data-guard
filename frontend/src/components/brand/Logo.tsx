/**
 * Marca do DataGuard: um D sólido com uma célula solta em lima, o dado que
 * escapou da guarda. O D usa currentColor; a célula usa o acento do produto.
 */
export function LogoMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 4H16C23.2 4 28 9 28 16C28 23 23.2 28 16 28H11V21H4Z M10 11H17V20H10Z"
      />
      <rect x="4" y="23" width="5" height="5" fill="var(--color-accent)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-[19px] text-fg" />
      <span className="text-sm font-semibold tracking-tight">
        Data<span className="text-accent">Guard</span>
      </span>
    </span>
  );
}
