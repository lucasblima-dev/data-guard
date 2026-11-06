import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useMemo } from "react";
import { easeOutExpo } from "../../lib/motion";

interface CountUpProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Segundos. */
  duration?: number;
  /** Usa a fonte sans (numeros de destaque) em vez da mono de dados. */
  plain?: boolean;
  className?: string;
}

/** Numero que conta de 0 ate `value` ao montar ou mudar. Mono por padrao. */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 0.9,
  plain = false,
  className = "",
}: CountUpProps) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const fmt = useMemo(
    () => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    [decimals],
  );
  const text = useTransform(mv, (v) => `${prefix}${fmt.format(v)}${suffix}`);

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: easeOutExpo });
    return () => controls.stop();
  }, [value, duration, reduce, mv]);

  return <motion.span className={`${plain ? "tabular-nums" : "data"} ${className}`}>{text}</motion.span>;
}
