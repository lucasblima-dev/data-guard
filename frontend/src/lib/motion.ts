import type { Transition, Variants } from "framer-motion";

/**
 * Movimento de precisao: sem bounce nem overshoot.
 * Entradas ~200 ms; saidas ~140 ms, mais decididas.
 */
export const DURATION = { enter: 0.2, snap: 0.16, exit: 0.14 } as const;

/** Desaceleracao firme (sem overshoot) para entradas. */
export const easeDecisive = [0.2, 0, 0, 1] as const;
/** Aceleracao curta para saidas. */
export const easeExit = [0.4, 0, 1, 1] as const;
/** Desaceleracao longa, para barras e preenchimentos. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeStandard = [0.32, 0.72, 0, 1] as const;

export const tweenEnter: Transition = { duration: DURATION.enter, ease: easeDecisive };
export const tweenSnap: Transition = { duration: DURATION.snap, ease: easeDecisive };
export const tweenExit: Transition = { duration: DURATION.exit, ease: easeExit };

/** @deprecated Nomes legados; agora sao tweens (sem spring). Prefira tweenEnter/tweenSnap. */
export const springSoft: Transition = tweenEnter;
/** @deprecated Ver springSoft. */
export const springSnappy: Transition = tweenSnap;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: tweenEnter },
  exit: { opacity: 0, transition: tweenExit },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tweenEnter },
  exit: { opacity: 0, transition: tweenExit },
};

/** Container que escalona a entrada dos filhos. */
export const stagger = (delay = 0.035): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.04 } },
});

/** Microinteracao de clique: so compressao, sem elevacao. */
export const press = {
  whileTap: { scale: 0.98 },
  transition: tweenSnap,
} as const;
