import { motion } from "framer-motion";
import { CheckCircle2, OctagonAlert, Plus, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AnalysesStats } from "../../api/analysesApi";
import { Card } from "../../components/ui/Card";
import { CountUp } from "../../components/ui/CountUp";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { fadeUp, stagger, tweenSnap } from "../../lib/motion";

const small = [
  { key: "completed", label: "Concluídas", icon: CheckCircle2, tone: "text-ok" },
  { key: "inProgress", label: "Em andamento", icon: Radio, tone: "text-info" },
  { key: "failed", label: "Falhas", icon: OctagonAlert, tone: "text-danger" },
] as const;

export function StatsRow({ stats }: { stats: AnalysesStats | null }) {
  const navigate = useNavigate();
  const rate = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : null;

  return (
    <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-12">
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-card bg-accent p-7 text-accent-fg shadow-[0_40px_90px_-40px_rgb(214_255_61/0.45)] lg:col-span-5"
      >
        <div aria-hidden className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2">
          {[220, 320].map((s) => (
            <span
              key={s}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.07]"
              style={{ width: s, height: s }}
            />
          ))}
        </div>
        <div className="relative flex items-center justify-between gap-6">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium opacity-75">Auditorias realizadas</p>
            {stats ? (
              <CountUp plain value={stats.total} className="text-7xl font-semibold leading-none tracking-tighter" />
            ) : (
              <span className="h-[4.5rem] w-24 animate-pulse-soft rounded-xl bg-black/10" />
            )}
            <motion.button
              type="button"
              onClick={() => navigate("/upload")}
              whileTap={{ scale: 0.98 }}
              transition={tweenSnap}
              className="focus-ring mt-1 inline-flex h-11 w-fit items-center gap-3 rounded-full bg-canvas pl-5 pr-1.5 text-sm font-medium text-fg"
            >
              Nova análise
              <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-fg">
                <Plus className="size-4" strokeWidth={2.25} />
              </span>
            </motion.button>
          </div>
          {rate !== null && <ProgressRing value={rate} label="concluídas" className="size-36" />}
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-4 lg:col-span-7">
        {small.map(({ key, label, icon: Icon, tone }) => (
          <Card key={key} className="flex flex-col justify-between gap-6 p-5">
            <span className={`grid size-9 place-items-center rounded-xl bg-fg/[0.05] ${tone}`}>
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div>
              {stats ? (
                <CountUp value={stats[key]} className="text-3xl font-semibold tracking-tighter" />
              ) : (
                <span className="inline-block h-8 w-12 animate-pulse-soft rounded-md bg-fg/8" />
              )}
              <p className="mt-1 text-xs text-fg-subtle">{label}</p>
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
