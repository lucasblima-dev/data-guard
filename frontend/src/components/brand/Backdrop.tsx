/**
 * Fundo da marca: preto profundo, um brilho de lima parado no canto inferior
 * direito e granulacao fina. Estatico, sem reagir ao mouse.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -bottom-56 -right-56 size-[760px] rounded-full"
        style={{
          background: "radial-gradient(closest-side, color-mix(in oklab, var(--dg-accent) var(--dg-glow), transparent), transparent)",
        }}
      />
      <div className="bg-grain absolute inset-0" style={{ opacity: "var(--dg-grain)" }} />
    </div>
  );
}
