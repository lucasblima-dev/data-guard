import { AnimatePresence, motion } from "framer-motion";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { easeOutExpo, springSnappy, springSoft } from "../../lib/motion";
import { formatBytes } from "../../lib/format";
import { MAX_CSV_MB } from "./validateCsv";

interface DropzoneProps {
  file: File | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export function Dropzone({ file, disabled = false, onSelect, onClear }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0); // dragenter/leave disparam nos filhos: conta a profundidade
  const [dragging, setDragging] = useState(false);

  const open = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    depth.current += 1;
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (!disabled && dropped) onSelect(dropped);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  return (
    <div>
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Selecionar arquivo CSV"
        aria-disabled={disabled}
        onClick={open}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        animate={{ scale: dragging ? 1.015 : 1 }}
        transition={springSoft}
        className="focus-ring glass relative flex min-h-80 cursor-pointer flex-col items-center justify-center gap-5 overflow-hidden rounded-card border-dashed px-6 py-14 text-center"
      >
        {/* Borda e brilho que acendem ao arrastar */}
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: dragging ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none absolute inset-0 rounded-card border border-accent shadow-[0_0_0_4px_var(--color-ring),0_0_48px_-8px_var(--color-accent)]"
        />
        <motion.div
          aria-hidden
          initial={false}
          animate={{ opacity: dragging ? 1 : 0 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_16%,transparent),transparent)]"
        />

        <motion.div
          animate={{ y: dragging ? -6 : 0, scale: dragging ? 1.1 : 1 }}
          transition={springSnappy}
          className={`relative grid size-16 place-items-center rounded-2xl ring-1 ring-inset transition-colors duration-150 ${
            dragging ? "bg-accent text-accent-fg ring-transparent" : "bg-accent/10 text-accent-ink ring-accent/20"
          }`}
        >
          <UploadCloud className="size-7" strokeWidth={1.5} />
        </motion.div>

        <div className="relative space-y-1">
          <p className="text-sm font-medium">{dragging ? "Solte para selecionar" : "Arraste seu dataset aqui"}</p>
          <p className="text-xs text-fg-subtle">
            ou <span className="text-accent-ink">escolha no dispositivo</span> · CSV até {MAX_CSV_MB} MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel"
          className="hidden"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onSelect(picked);
            e.target.value = ""; // permite reselecionar o mesmo arquivo
          }}
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {file && (
          <motion.div
            key={`${file.name}-${file.size}`}
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            className="overflow-hidden"
          >
            <div className="glass mt-3 flex items-center gap-3 rounded-card px-4 py-3">
              <FileSpreadsheet className="size-4 shrink-0 text-ok" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="font-mono text-2xs text-fg-subtle">{formatBytes(file.size)}</p>
              </div>
              <motion.button
                type="button"
                onClick={onClear}
                disabled={disabled}
                whileTap={{ scale: 0.9 }}
                aria-label="Remover arquivo"
                className="focus-ring grid size-7 place-items-center rounded-control text-fg-subtle transition-colors hover:bg-fg/5 hover:text-fg disabled:opacity-40"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
