import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { easeOutExpo, springSoft } from "../../lib/motion";
import type { JobStatus } from "../../types/analysis";

const STEPS: { status: JobStatus; label: string; hint: string }[] = [
  { status: "enviada", label: "Enviada", hint: "Recebimento concluído" },
  { status: "validando", label: "Validando", hint: "Schema e encoding" },
  { status: "analisando", label: "Analisando", hint: "Cálculo determinístico" },
  { status: "gerando_relatorio", label: "Relatório", hint: "Composição dos insights" },
  { status: "concluida", label: "Concluída", hint: "Pronto para leitura" },
];

type StepState = "done" | "current" | "pending";

function stateOf(index: number, current: number, failed: boolean): StepState {
  if (failed) return "pending";
  if (index < current) return "done";
  if (index === current) return current === STEPS.length - 1 ? "done" : "current";
  return "pending";
}

export function StatusStepper({ status }: { status: JobStatus }) {
  const failed = status === "falhou";
  const current = failed ? -1 : STEPS.findIndex((s) => s.status === status);
  const progress = failed ? 0 : (current / (STEPS.length - 1)) * 100;
  const nextProgress = ((current + 1) / (STEPS.length - 1)) * 100;
  const reduce = useReducedMotion();
  const pulse = !reduce && !failed && current >= 0 && current < STEPS.length - 1;

  return (
    <ol aria-label="Progresso da análise" className="relative grid gap-5 sm:grid-cols-5 sm:gap-0">
      {/* Trilha (desktop): fundo + preenchimento animado */}
      <div aria-hidden className="absolute left-[10%] right-[10%] top-3.5 hidden h-px bg-line-strong sm:block">
        <motion.div
          className="h-px origin-left bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: easeOutExpo }}
        />
        {/* Pulso de luz correndo ate a proxima etapa, enquanto a atual esta ativa */}
        {pulse && (
          <motion.span
            key={current}
            className="absolute top-1/2 h-[3px] w-14 -translate-x-full -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent to-accent shadow-[0_0_10px_var(--color-accent)]"
            initial={{ left: `${progress}%`, opacity: 0 }}
            animate={{ left: [`${progress}%`, `${nextProgress}%`], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.5, ease: "linear", times: [0, 0.15, 0.85, 1] }}
          />
        )}
      </div>

      {STEPS.map((step, i) => {
        const state = stateOf(i, current, failed);
        return (
          <li
            key={step.status}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex items-center gap-4 sm:flex-col sm:gap-3 sm:text-center"
          >
            <div
              className="relative grid size-7 shrink-0 place-items-center"
              data-step-last={i === STEPS.length - 1 ? "" : undefined}
            >
              {state === "current" && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/40" />
              )}
              <motion.span
                initial={false}
                animate={{
                  scale: state === "current" ? 1.08 : 1,
                  backgroundColor:
                    state === "pending" ? "rgb(128 128 128 / 0.12)" : "var(--color-accent)",
                }}
                transition={springSoft}
                className={`relative grid size-7 place-items-center rounded-full ring-1 ring-inset ${
                  state === "pending" ? "ring-line-strong" : "ring-transparent"
                }`}
              >
                {state === "done" ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={springSoft}
                    className="text-accent-fg"
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </motion.span>
                ) : (
                  <span
                    className={`size-1.5 rounded-full ${state === "current" ? "bg-accent-fg" : "bg-fg-subtle"}`}
                  />
                )}
              </motion.span>
            </div>
            <div>
              <p className={`text-sm font-medium ${state === "pending" ? "text-fg-subtle" : "text-fg"}`}>
                {step.label}
              </p>
              <p className="text-2xs text-fg-subtle">{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
