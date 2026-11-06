import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createAnalysis } from "../../api/analysesApi";
import { ApiError } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Dropzone } from "./Dropzone";
import { validateCsv } from "./validateCsv";

export function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Soltar fora da area nao deve fazer o navegador abrir o arquivo.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const handleSelect = (picked: File) => {
    const problem = validateCsv(picked);
    setError(problem);
    setFile(problem ? null : picked);
  };

  const handleSubmit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createAnalysis(file);
      navigate(`/analyses/${job.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Não foi possível enviar o arquivo.");
      toast.error("Falha ao iniciar a auditoria");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-10 pt-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tighter">Nova análise</h1>
        <p className="text-sm text-fg-muted">Envie um CSV para perfilar e auditar a qualidade dos dados.</p>
      </div>

      <div className="space-y-5">
        <Dropzone
          file={file}
          disabled={submitting}
          onSelect={handleSelect}
          onClear={() => {
            setFile(null);
            setError(null);
          }}
        />

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 text-sm text-danger"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex justify-end">
          <Button variant="primary" className="h-9 px-4" disabled={!file || submitting} onClick={handleSubmit}>
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
                Enviando
              </>
            ) : (
              <>
                <Play className="size-3.5" strokeWidth={2} />
                Iniciar auditoria
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
