import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, SearchX, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { isTerminal, useAnalysis } from "../../hooks/useAnalysis";
import { useAnalysisReport } from "../../hooks/useAnalysisReport";
import { formatBytes, formatDate, formatTime } from "../../lib/format";
import { tweenExit } from "../../lib/motion";
import { jobStatusMeta } from "../../lib/status";
import { ResultsDashboard } from "../quality/ResultsDashboard";
import type { JobStatus } from "../../types/analysis";
import { CompletionReveal } from "./CompletionReveal";
import { FailureCard } from "./FailureCard";
import { StatusStepper } from "./StatusStepper";

function Notice({ icon, text, action }: { icon: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      {icon}
      <p className="max-w-sm text-sm text-fg-muted">{text}</p>
      {action}
    </Card>
  );
}

export function AnalysisPage() {
  const { id = "" } = useParams();
  const { job, error, retry } = useAnalysis(id);
  const done = job?.status === "concluida";
  const report = useAnalysisReport(id, done);
  const reduceMotion = useReducedMotion();

  // A animacao de conclusao so toca quando o status vira `concluida` com a pagina aberta;
  // abrir uma analise ja concluida (ex.: pelo historico) mostra o resultado direto.
  const prevStatus = useRef<JobStatus | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [holding, setHolding] = useState(false);
  const status = job?.status ?? null;

  useEffect(() => {
    if (!status) return;
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (prev && !isTerminal(prev) && status === "concluida" && !reduceMotion) {
      setCelebrating(true);
      setCelebrated(true);
      setHolding(true);
    }
  }, [status, reduceMotion]);

  const handleLand = useCallback(() => setHolding(false), []);
  const handleDone = useCallback(() => setCelebrating(false), []);

  if (!job && error) {
    const notFound = error.status === 404 || error.status === 422;
    return (
      <Notice
        icon={<SearchX className="size-5 text-fg-subtle" strokeWidth={1.5} />}
        text={notFound ? "Análise não encontrada." : error.message}
        action={
          notFound ? (
            <Link to="/" className="text-sm text-accent hover:underline">
              Voltar ao histórico
            </Link>
          ) : (
            <Button onClick={retry}>Tentar novamente</Button>
          )
        }
      />
    );
  }

  if (!job) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 animate-pulse-soft rounded bg-fg/8" />
        <div className="h-28 animate-pulse-soft rounded-card bg-fg/5" />
      </div>
    );
  }

  const meta = jobStatusMeta[job.status];
  const details = report.details;

  return (
    <div className="space-y-12">
      <div className="space-y-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-fg-subtle transition-colors hover:text-fg">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          Histórico
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="truncate text-2xl font-semibold tracking-tighter" title={job.original_filename}>
              {job.original_filename}
            </h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
              <span>
                {formatDate(job.created_at)} · {formatTime(job.created_at)}
              </span>
              <span className="font-mono">{formatBytes(job.file_size_bytes)}</span>
              <span className="font-mono">{job.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={meta.tone} live={meta.active}>
              {meta.label}
            </Badge>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!done && (
          <motion.div key="stepper" exit={{ opacity: 0, transition: tweenExit }}>
            <Card className="px-6 py-8">
              <StatusStepper status={job.status} />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="-mt-6 flex items-center gap-2 text-xs text-warn"
          >
            <WifiOff className="size-3.5" strokeWidth={1.75} />
            Conexão instável. Tentando atualizar novamente.
          </motion.p>
        )}
      </AnimatePresence>

      {job.status === "falhou" && <FailureCard job={job} />}

      {done && (
        <div className="space-y-12">
          {report.loading && <div className="h-40 animate-pulse-soft rounded-card bg-fg/5" />}
          {report.error && (
            <Notice
              icon={<SearchX className="size-5 text-warn" strokeWidth={1.5} />}
              text={report.error.message}
              action={<Button onClick={report.retry}>Tentar novamente</Button>}
            />
          )}
          {!report.loading && !report.error && !details && (
            <Notice
              icon={<SearchX className="size-5 text-fg-subtle" strokeWidth={1.5} />}
              text="A análise foi concluída, mas o relatório detalhado ainda não está disponível no serviço."
            />
          )}
          {details?.profile && <ResultsDashboard details={details} hold={holding} instantHero={celebrated} />}
        </div>
      )}

      <AnimatePresence>
        {celebrating && (
          <CompletionReveal
            rows={details?.profile?.row_count ?? null}
            failed={!report.loading && !details?.profile}
            onLand={handleLand}
            onDone={handleDone}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
