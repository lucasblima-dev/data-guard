import type { Transition, Variants } from "framer-motion";

/** Curvas espelhadas de --ease-* em index.css. */
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeStandard = [0.32, 0.72, 0, 1] as const;

/** Spring curta e sem overshoot: sensacao de "peso" tipica de iOS/Linear. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 34,
  mass: 0.8,
};

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 38,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOutExpo } },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: easeStandard } },
};

/** Container que escalona a entrada dos filhos. */
export const stagger = (delay = 0.04): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

/** Microinteracoes para elementos clicaveis. */
export const press = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
  transition: springSnappy,
} as const;
