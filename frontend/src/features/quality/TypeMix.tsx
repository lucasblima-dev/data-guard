import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { easeOutExpo } from "../../lib/motion";
import { TYPE_LABELS } from "../../lib/quality";
import type { DatasetProfile } from "../../types/analysis";

const shades = ["bg-accent", "bg-accent/65", "bg-accent/40", "bg-accent/25"];

export function TypeMix({ profile }: { profile: DatasetProfile }) {
  const cols = Object.values(profile.columns_summary);
  const counts = cols.reduce<Record<string, number>>((acc, c) => {
    acc[c.data_type] = (acc[c.data_type] ?? 0) + 1;
    return acc;
  }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium">Composição de tipos</h3>
      <p className="mt-0.5 text-xs text-fg-subtle">Inferência do schema.</p>
      <ul className="mt-6 space-y-5">
        {rows.map(([type, count], i) => {
          const pct = (count / cols.length) * 100;
          return (
            <li key={type}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-fg-muted">{TYPE_LABELS[type] ?? type}</span>
                <span className="data text-xs text-fg">{Math.round(pct)}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/[0.07]">
                <motion.div
                  className={`h-full rounded-full ${shades[Math.min(i, shades.length - 1)]}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.2 + i * 0.06 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
