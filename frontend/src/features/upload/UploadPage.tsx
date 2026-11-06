import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { createAnalysis } from "../../api/analysesApi";
import { ApiError } from "../../api/client";
import { PageHeader } from "../../components/layout/PageHeader";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { fadeUp, stagger } from "../../lib/motion";
import { Dropzone } from "./Dropzone";
import { validateCsv } from "./validateCsv";

const pipeline = [
  { label: "Envio", hint: "Recebimento do arquivo" },
  { label: "Validação", hint: "Schema e encoding" },
  { label: "Análise", hint: "Perfilamento determinístico" },
  { label: "Relatório", hint: "Síntese dos achados" },
];

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
    <div className="space-y-8">
      <PageHeader
        eyebrow="nova análise"
        title="Enviar dataset"
        description="Perfile e audite a qualidade dos seus dados tabulares."
      />

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-12">
        <motion.div variants={fadeUp} className="space-y-5 lg:col-span-8">
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
            <Button variant="primary" className="h-11 px-6" disabled={!file || submitting} onClick={handleSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  Enviando
                </>
              ) : (
                <>
                  Iniciar auditoria
                  <ArrowRight className="size-4" strokeWidth={2} />
                </>
              )}
            </Button>
          </div>
        </motion.div>

        <div className="space-y-4 lg:col-span-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium">O que acontece depois</h3>
            <ol className="mt-5 space-y-4">
              {pipeline.map((step, i) => (
                <li key={step.label} className="flex items-start gap-3">
                  <span className="data mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/10 text-2xs text-accent ring-1 ring-inset ring-accent/20">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm">{step.label}</p>
                    <p className="text-xs text-fg-subtle">{step.hint}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

        </div>
      </motion.div>
    </div>
  );
}
