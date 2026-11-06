import { motion } from "framer-motion";
import { Card } from "../../components/ui/Card";
import { bucketCell, bucketLabel, nullBucket, type NullBucket } from "../../lib/quality";
import { tweenEnter } from "../../lib/motion";
import type { DatasetProfile } from "../../types/analysis";

const legend: NullBucket[] = ["clean", "low", "mid", "high"];

/** Mapa do dataset: uma celula por coluna, colorida pela taxa de nulos. */
export function DatasetMap({ profile }: { profile: DatasetProfile }) {
  const columns = Object.entries(profile.columns_summary);

  return (
    <Card className="p-6">
      <h3 className="text-sm font-medium">Mapa do dataset</h3>
      <p className="mt-0.5 text-xs text-fg-subtle">Uma célula por coluna, pela taxa de nulos.</p>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {columns.map(([name, col], i) => {
          const bucket = nullBucket(col.null_percentage);
          return (
            <motion.div
              key={name}
              tabIndex={0}
              role="img"
              aria-label={`${name}: ${col.null_percentage}% de nulos`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...tweenEnter, delay: 0.25 + i * 0.03 }}
              className={`group relative aspect-square rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring ${bucketCell[bucket]}`}
            >
              <span className="data pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-2xs text-canvas opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {name} · {col.null_percentage.toFixed(1).replace(".", ",")}%
              </span>
            </motion.div>
          );
        })}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-2xs text-fg-subtle">
        {legend.map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-sm ${bucketCell[b]}`} />
            {bucketLabel[b]}
          </li>
        ))}
      </ul>
    </Card>
  );
}
