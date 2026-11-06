import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../../components/ui/Card";
import { bucketColor, nullBucket } from "../../lib/quality";
import type { DatasetProfile } from "../../types/analysis";

export function NullsChart({ profile }: { profile: DatasetProfile }) {
  const data = Object.entries(profile.columns_summary)
    .map(([name, c]) => ({ name, value: Number(c.null_percentage.toFixed(2)) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium">Valores ausentes</h3>
      <p className="mt-0.5 text-xs text-fg-subtle">Maiores taxas por atributo.</p>
      <div className="mt-4" style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }} barCategoryGap={8}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={124}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-fg-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            />
            <Tooltip
              cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
              formatter={(v) => [`${String(v).replace(".", ",")}%`, "Nulos"]}
              contentStyle={{
                background: "var(--color-surface-solid)",
                border: "1px solid var(--color-line-strong)",
                borderRadius: 10,
                fontSize: 12,
                color: "var(--color-fg)",
              }}
              labelStyle={{ color: "var(--color-fg)" }}
              itemStyle={{ color: "var(--color-fg)" }}
            />
            <Bar dataKey="value" radius={6} barSize={10} animationDuration={700}>
              {data.map((d) => (
                <Cell key={d.name} fill={bucketColor[nullBucket(d.value)]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
