import { motion } from "framer-motion";
import { easeOutExpo } from "../../lib/motion";
import { CountUp } from "./CountUp";

const R = 68;
const C = 2 * Math.PI * R;

interface ProgressRingProps {
  /** 0 a 100. */
  value: number;
  label: string;
  /** Cor via currentColor: defina com text-* no contexto. */
  className?: string;
}

/** Anel de progresso animado, com o valor contando no centro. */
export function ProgressRing({ value, label, className = "size-44" }: ProgressRingProps) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`relative grid shrink-0 place-items-center ${className}`}>
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={R} fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="12" />
        <motion.circle
          cx="80"
          cy="80"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - v / 100) }}
          transition={{ duration: 1, ease: easeOutExpo, delay: 0.1 }}
        />
      </svg>
      <div className="text-center">
        <CountUp plain value={v} className="text-4xl font-semibold tracking-tighter" />
        <p className="text-2xs font-medium opacity-70">{label}</p>
      </div>
    </div>
  );
}
