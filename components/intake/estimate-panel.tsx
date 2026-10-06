import { Alert, type AlertTone } from "@/components/arc/alert/alert";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import { Progress } from "@/components/arc/progress/progress";
import { formatDay } from "@/lib/dates";
import type { BriefTier, Estimate } from "@/lib/estimate";
import styles from "./request-form.module.css";

const TIER: Record<BriefTier, { tone: AlertTone; title: string }> = {
  completo: { tone: "success", title: "El brief está completo: se puede arrancar en cuanto haya capacidad." },
  parcial: { tone: "info", title: "El brief sirve para arrancar, pero completarlo acorta la entrega." },
  incompleto: { tone: "warning", title: "Con este brief el equipo tendrá que pedirte más información antes de arrancar." },
};

/** Same estimate the server writes to monday, shown before sending so the requester sees what moves the date. */
export function EstimatePanel({ result }: { result: Estimate }) {
  const tier = TIER[result.tier];
  return (
    <div className={styles.estimate} aria-live="polite">
      <MetricCard label="Entrega estimada" value={result.days} suffix={" días hábiles"} context={`Lista el ${formatDay(result.date)}`} />
      <Progress label="Calidad del brief" value={result.score} showValue />
      <Alert tone={tier.tone} title={tier.title}>
        {result.missing.length > 0 ? `Para mejorarlo: ${result.missing.join(". ")}.` : undefined}
      </Alert>
      {result.tight && (
        <Alert tone="warning" title="La fecha requerida es anterior a la estimada">
          El equipo revisará si es posible. Completar el brief o subir la prioridad ayuda.
        </Alert>
      )}
    </div>
  );
}
