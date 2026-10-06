import { Alert } from "@/components/arc/alert/alert";
import { Progress } from "@/components/arc/progress/progress";
import { formatDay } from "@/lib/dates";
import type { Estimate } from "@/lib/estimate";
import styles from "./request-form.module.css";

const TIER_COPY: Record<Estimate["tier"], string> = {
  completo: "El brief está completo: se puede arrancar en cuanto haya capacidad.",
  parcial: "El brief sirve para arrancar, pero completarlo acorta la entrega.",
  incompleto: "Con este brief el equipo tendrá que pedirte más información antes de arrancar.",
};

/** Live preview of the same estimate the server writes to monday, so the requester sees what moves the date. */
export function EstimatePanel({ result }: { result: Estimate }) {
  return (
    <aside className={styles.estimate} aria-live="polite">
      <div className={styles.estimateHead}>
        <span>Entrega estimada</span>
        <strong>{formatDay(result.date)}</strong>
        <span className={styles.muted}>{result.days} días hábiles</span>
      </div>
      <Progress label="Calidad del brief" value={result.score} showValue />
      <p className={styles.muted}>{TIER_COPY[result.tier]}</p>
      {result.missing.length > 0 && (
        <ul className={styles.missing}>
          {result.missing.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}
      {result.tight && (
        <Alert tone="warning" title="La fecha requerida es anterior a la estimada">
          El equipo revisará si es posible. Completar el brief o subir la prioridad ayuda.
        </Alert>
      )}
    </aside>
  );
}
