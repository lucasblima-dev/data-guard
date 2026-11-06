import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { CountUp } from "../../components/ui/CountUp";
import { fadeUp, stagger, tweenEnter, tweenExit } from "../../lib/motion";

/** Pagina de desenvolvimento (somente em `npm run dev`) para validar a fundacao visual. */
const swatches = [
  { name: "accent (lima)", cls: "bg-accent" },
  { name: "signal-cyan", cls: "bg-signal-cyan" },
  
  { name: "ok", cls: "bg-ok" },
  { name: "warn", cls: "bg-warn" },
  { name: "danger", cls: "bg-danger" },
  { name: "info", cls: "bg-info" },
  { name: "progress", cls: "bg-progress" },
];

const columns = [
  { name: "id_venda", type: "numeric", nulls: 0, unique: 104432 },
  { name: "email_cliente", type: "categorical", nulls: 38.4, unique: 61904 },
  { name: "valor_total", type: "numeric", nulls: 0.4, unique: 18732 },
  { name: "codigo_rastreio", type: "categorical", nulls: 21.9, unique: 81870 },
];

export function FoundationPreview() {
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(true);

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-12">
      <motion.div variants={fadeUp} className="space-y-2">
        <p className="data text-2xs uppercase tracking-wider text-accent">fundação visual · somente dev</p>
        <h1 className="text-2xl font-semibold tracking-tighter">Identidade lima</h1>
        <p className="max-w-xl text-sm text-fg-muted">
          Preto profundo, lima elétrico e dados em fonte monoespaçada.
        </p>
      </motion.div>

      <motion.section variants={fadeUp} className="space-y-4">
        <h2 className="text-xs font-medium text-fg-subtle">Paleta</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map((s) => (
            <div key={s.name} className="glass rounded-card p-3">
              <div className={`h-10 rounded-control ${s.cls}`} />
              <p className="data mt-2 text-2xs text-fg-muted">{s.name}</p>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-fg-subtle">Dados em mono com contagem</h2>
          <Button variant="ghost" onClick={() => setRun((n) => n + 1)}>
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Repetir
          </Button>
        </div>
        <Card className="overflow-hidden">
          <table key={run} className="w-full border-collapse text-left">
            <thead>
              <tr className="text-2xs uppercase tracking-wider text-fg-subtle">
                <th className="px-6 py-3 font-medium">Coluna</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Nulos</th>
                <th className="px-6 py-3 text-right font-medium">Únicos</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.name} className="border-t border-line">
                  <td className="data px-6 py-3.5 text-xs">{c.name}</td>
                  <td className="data px-4 py-3.5 text-xs text-fg-muted">{c.type}</td>
                  <td className="px-4 py-3.5 text-right text-xs">
                    <CountUp value={c.nulls} decimals={1} suffix="%" className={c.nulls > 30 ? "text-danger" : ""} />
                  </td>
                  <td className="px-6 py-3.5 text-right text-xs text-fg-muted">
                    <CountUp value={c.unique} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div key={`k${run}`} className="flex flex-wrap items-baseline gap-x-10 gap-y-3">
          <div>
            <p className="text-xs text-fg-subtle">Registros</p>
            <CountUp value={104850} className="text-2xl font-semibold" />
          </div>
          <div>
            <p className="text-xs text-fg-subtle">Média de nulos</p>
            <CountUp value={8.42} decimals={2} suffix="%" className="text-2xl font-semibold text-warn" />
          </div>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="space-y-4">
        <h2 className="text-xs font-medium text-fg-subtle">Movimento · entrada 200 ms, saída 140 ms</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setOpen((o) => !o)}>
            {open ? "Ocultar painel" : "Mostrar painel"}
          </Button>
          <Badge tone="progress" live>
            analisando
          </Badge>
          <Badge tone="ok">concluída</Badge>
          <Badge tone="danger">falhou</Badge>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: tweenEnter }}
              exit={{ opacity: 0, transition: tweenExit }}
              className="glass-strong rounded-card p-5 text-sm text-fg-muted"
            >
              Painel de teste: fade com leve deslocamento na entrada, saída seca, sem bounce.
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
