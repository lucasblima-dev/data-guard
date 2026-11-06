import { motion } from "framer-motion";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../../components/ui/Card";
import { fadeUp, stagger } from "../../lib/motion";
import type { DatasetProfile, QualityFinding } from "../../types/analysis";

const nf = new Intl.NumberFormat("pt-BR");

function nullColor(pct: number): string {
  if (pct > 30) return "var(--color-danger)";
  if (pct > 10) return "var(--color-warn)";
  return "var(--color-accent)";
}

const TYPE_LABELS: Record<string, string> = {
  numeric: "Numérico",
  categorical: "Categórico",
  temporal: "Temporal",
  textual: "Textual",
};

interface Props {
  profile: DatasetProfile;
  findings: QualityFinding[];
}

export function QualityOverview({ profile, findings }: Props) {
  const columns = Object.entries(profile.columns_summary);
  const avgNull = columns.length ? columns.reduce((acc, [, c]) => acc + c.null_percentage, 0) / columns.length : 0;

  const nullData = columns
    .map(([name, c]) => ({ name, value: Number(c.null_percentage.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const typeCounts = columns.reduce<Record<string, number>>((acc, [, c]) => {
    acc[c.data_type] = (acc[c.data_type] ?? 0) + 1;
    return acc;
  }, {});

  const kpis = [
    { label: "Registros", value: nf.format(profile.row_count) },
    { label: "Atributos", value: nf.format(profile.column_count) },
    { label: "Média de nulos", value: `${avgNull.toFixed(1).replace(".", ",")}%` },
    { label: "Achados", value: nf.format(findings.length) },
  ];

  return (
    <div className="space-y-8">
      <motion.dl
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4"
      >
        {kpis.map((k) => (
          <motion.div key={k.label} variants={fadeUp}>
            <dt className="text-xs text-fg-subtle">{k.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tighter">{k.value}</dd>
          </motion.div>
        ))}
      </motion.dl>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-sm font-medium">Valores ausentes por atributo</h3>
          <p className="mt-0.5 text-xs text-fg-subtle">Acima de 30% exige tratamento prioritário.</p>
          <div className="mt-5" style={{ height: Math.max(160, nullData.length * 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nullData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--color-fg-muted)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "rgb(128 128 128 / 0.08)" }}
                  formatter={(v) => [`${String(v).replace(".", ",")}%`, "Nulos"]}
                  contentStyle={{
                    background: "var(--color-surface-solid)",
                    border: "1px solid var(--color-line-strong)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "var(--color-fg)",
                  }}
                />
                <Bar dataKey="value" radius={4} barSize={10} isAnimationActive animationDuration={700}>
                  {nullData.map((d) => (
                    <Cell key={d.name} fill={nullColor(d.value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium">Composição de tipos</h3>
          <p className="mt-0.5 text-xs text-fg-subtle">Inferência do schema.</p>
          <ul className="mt-6 space-y-4">
            {Object.entries(typeCounts).map(([type, count]) => {
              const pct = (count / columns.length) * 100;
              return (
                <li key={type}>
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-muted">{TYPE_LABELS[type] ?? type}</span>
                    <span className="tabular-nums text-fg-subtle">{count}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fg/8">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
