import { motion } from "framer-motion";
import { Printer } from "lucide-react";
import { CountUp } from "../../components/ui/CountUp";
import { ProgressRing } from "../../components/ui/ProgressRing";
import { fadeUp, tweenSnap } from "../../lib/motion";
import type { DatasetProfile, QualityFinding } from "../../types/analysis";

interface Props {
  profile: DatasetProfile;
  findings: QualityFinding[];
  score: number | null;
  onPrint: () => void;
  /** Mostra o total de registros sem contar (ja exibido pela animacao de conclusao). */
  instant?: boolean;
}

export function HealthHero({ profile, findings, score, onPrint, instant = false }: Props) {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warning = findings.filter((f) => f.severity === "warning").length;

  return (
    <motion.div
      data-hero=""
      variants={fadeUp}
      className="relative overflow-hidden rounded-card bg-accent p-7 text-accent-fg shadow-[0_40px_90px_-40px_rgb(214_255_61/0.5)] sm:p-8"
    >
      {/* Aneis concentricos decorativos */}
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2">
        {[260, 360, 460].map((s) => (
          <span
            key={s}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.07]"
            style={{ width: s, height: s }}
          />
        ))}
      </div>

      <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium opacity-75">Registros analisados</p>
          <CountUp
            plain
            instant={instant}
            value={profile.row_count}
            duration={1.1}
            className="text-6xl font-semibold leading-none tracking-tighter sm:text-8xl"
          />
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full bg-black/10 px-3 py-1">{profile.column_count} colunas</span>
            <span className="rounded-full bg-black/10 px-3 py-1">{critical} críticos</span>
            <span className="rounded-full bg-black/10 px-3 py-1">{warning} atenção</span>
          </div>
          <motion.button
            type="button"
            onClick={onPrint}
            whileTap={{ scale: 0.98 }}
            transition={tweenSnap}
            className="focus-ring mt-2 inline-flex h-11 w-fit items-center gap-3 rounded-full bg-canvas pl-5 pr-1.5 text-sm font-medium text-fg"
          >
            Imprimir laudo
            <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-fg">
              <Printer className="size-3.5" strokeWidth={2} />
            </span>
          </motion.button>
        </div>

        {score !== null && <ProgressRing value={score} label="saúde do dataset" />}
      </div>
    </motion.div>
  );
}
