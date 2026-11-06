import { motion } from "framer-motion";
import type { AnalysesStats } from "../../api/analysesApi";
import { fadeUp, stagger } from "../../lib/motion";

const items: { key: keyof AnalysesStats; label: string }[] = [
  { key: "total", label: "Auditorias" },
  { key: "completed", label: "Concluídas" },
  { key: "inProgress", label: "Em andamento" },
  { key: "failed", label: "Falhas" },
];

export function StatsRow({ stats }: { stats: AnalysesStats | null }) {
  return (
    <motion.dl
      variants={stagger(0.06)}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4"
    >
      {items.map(({ key, label }) => (
        <motion.div key={key} variants={fadeUp}>
          <dt className="text-xs text-fg-subtle">{label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tighter">
            {stats ? stats[key] : <span className="inline-block h-7 w-10 animate-pulse-soft rounded-md bg-fg/8" />}
          </dd>
        </motion.div>
      ))}
    </motion.dl>
  );
}
