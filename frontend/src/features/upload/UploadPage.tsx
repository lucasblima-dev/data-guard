import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAnalysis, wakeBackend } from "../../api/analysesApi";
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
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);

  // Acorda o servico (plano gratuito) enquanto o usuario escolhe o arquivo.
  useEffect(() => {
    wakeBackend();
  }, []);

  // Se o envio demora, explica o motivo em vez de parecer travado.
  useEffect(() => {
    if (!submitting) {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(t);
  }, [submitting]);

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

  const handleSelect = async (picked: File) => {
    const problem = validateCsv(picked);
    if (problem) {
      setError({ title: "Arquivo inválido", message: problem });
      setFile(null);
      return;
    }
    // Copia o conteudo para a memoria ja na selecao. No celular, arquivos vindos de nuvem
    // (Drive, iCloud) ou "Downloads" podem mudar ou sumir antes do envio e o navegador
    // aborta o upload com um erro de rede generico (ERR_UPLOAD_FILE_CHANGED).
    try {
      const content = await picked.arrayBuffer();
      setFile(new File([content], picked.name, { type: "text/csv", lastModified: picked.lastModified }));
      setError(null);
    } catch {
      setFile(null);
      setError({
        title: "Não foi possível ler o arquivo",
        message:
          "O navegador não conseguiu abrir o arquivo. Se ele está no Google Drive ou em outro aplicativo, baixe-o para o aparelho e selecione novamente.",
      });
    }
  };

  const handleSubmit = async () => {
    if (!file || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createAnalysis(file);
      navigate(`/analyses/${job.id}`);
    } catch (e) {
      setError({
        title: "Não foi possível iniciar a auditoria",
        message: e instanceof ApiError ? e.message : "Não foi possível enviar o arquivo.",
      });
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

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-4 xl:grid-cols-12">
        <motion.div variants={fadeUp} className="space-y-5 xl:col-span-8">
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
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-4 rounded-card border border-danger/25 bg-danger/[0.06] p-5 backdrop-blur-xl"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/12 text-danger ring-1 ring-inset ring-danger/20">
                  <TriangleAlert className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">{error.title}</p>
                  <p className="mt-1 text-sm text-fg-muted">{error.message}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {slow && (
              <motion.p
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-fg-muted"
              >
                O servidor está iniciando (plano gratuito) e pode levar até 1 minuto. Mantenha esta tela aberta.
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

        <div className="space-y-4 xl:col-span-4">
          <Card className="p-6">
            <h3 className="text-sm font-medium">O que acontece depois</h3>
            <ol className="mt-5 space-y-4">
              {pipeline.map((step, i) => (
                <li key={step.label} className="flex items-start gap-3">
                  <span className="data mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent/10 text-2xs text-accent-ink ring-1 ring-inset ring-accent/20">
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
