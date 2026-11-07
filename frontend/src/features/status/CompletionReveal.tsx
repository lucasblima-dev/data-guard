import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { CountUp } from "../../components/ui/CountUp";

type Phase = "flood" | "hold" | "shrink";

interface Props {
  /** Registros analisados; null enquanto o relatorio carrega. */
  rows: number | null;
  /** Relatorio resolvido sem dados: encerra sem mostrar numero. */
  failed: boolean;
  /** O retangulo lima chegou ao hero: libera a cascata dos blocos. */
  onLand: () => void;
  /** Pode desmontar o overlay. */
  onDone: () => void;
}

// Ritmo calmo: e uma analise, nao um efeito de impacto.
const FLOOD_S = 1.4;
const COUNT_S = 1.6;
const PAUSE_AFTER_COUNT_MS = 900;
const SHRINK_S = 0.95;
const HERO_RADIUS = 20;
const easeCalm = [0.4, 0, 0.2, 1] as const;

function readOrigin(): { x: number; y: number } {
  const el = document.querySelector("[data-step-last]");
  if (el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * Momento de conclusao: o lima preenche a tela a partir do ultimo passo, mostra o
 * total de registros e encolhe ate a posicao do hero. Clique ou Esc pulam.
 */
export function CompletionReveal({ rows, failed, onLand, onDone }: Props) {
  const [origin] = useState(readOrigin);
  const [phase, setPhase] = useState<Phase>("flood");
  const [inset, setInset] = useState<string | null>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onLand();
    onDone();
  }, [onLand, onDone]);

  // Trava o scroll e leva a pagina ao topo (onde o hero esta) enquanto o overlay cobre tudo.
  useEffect(() => {
    window.scrollTo(0, 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  // Segura o numero na tela e, so entao, encolhe ate o hero.
  useEffect(() => {
    if (phase !== "hold") return;
    if (failed) {
      finish();
      return;
    }
    if (rows === null) return;
    const timer = window.setTimeout(() => {
      const hero = document.querySelector("[data-hero]");
      if (!hero) {
        finish();
        return;
      }
      const r = hero.getBoundingClientRect();
      setInset(`inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px round ${HERO_RADIUS}px)`);
      setPhase("shrink");
    }, COUNT_S * 1000 + PAUSE_AFTER_COUNT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, rows, failed, finish]);

  const radius = Math.hypot(window.innerWidth, window.innerHeight);
  const target =
    phase === "flood"
      ? { clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)`, opacity: 1 }
      : phase === "hold"
        ? { clipPath: "inset(0px 0px 0px 0px round 0px)", opacity: 1 }
        : { clipPath: inset ?? "inset(0px 0px 0px 0px round 0px)", opacity: 1 };
  const transition =
    phase === "flood"
      ? { duration: FLOOD_S, ease: easeCalm }
      : phase === "hold"
        ? { duration: 0 }
        : { duration: SHRINK_S, ease: easeCalm };

  return (
    <motion.div
      role="status"
      aria-live="polite"
      onClick={finish}
      initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`, opacity: 0 }}
      animate={target}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      transition={transition}
      onAnimationComplete={() => {
        if (phase === "flood") setPhase("hold");
        else if (phase === "shrink") finish();
      }}
      className="fixed inset-0 z-[60] grid cursor-pointer place-items-center bg-accent text-accent-fg"
    >
      <span className="sr-only">
        Análise concluída{rows !== null ? `, ${rows} registros analisados` : ""}.
      </span>
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "hold" ? 1 : 0, transition: { duration: phase === "hold" ? 0.6 : 0.3, delay: phase === "hold" ? 0.15 : 0, ease: "easeOut" } }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <p className="text-sm font-medium opacity-75">Análise concluída</p>
        {rows !== null ? (
          <>
            <CountUp plain value={rows} duration={COUNT_S} className="text-7xl font-semibold leading-none tracking-tighter sm:text-9xl" />
            <p className="text-sm font-medium opacity-75">registros analisados</p>
          </>
        ) : (
          <p className="animate-pulse-soft text-2xl font-semibold tracking-tight">Preparando resultados</p>
        )}
      </motion.div>
      <p className="absolute bottom-6 text-2xs font-medium opacity-50">clique ou Esc para pular</p>
    </motion.div>
  );
}
