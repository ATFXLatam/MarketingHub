import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { formatDay } from "@/lib/dates";
import type { Estimate } from "@/lib/estimate";

interface DoneScreenProps {
  estimate: Estimate;
  onAnother: () => void;
}

export function DoneScreen({ estimate, onAnother }: DoneScreenProps) {
  const next =
    estimate.initialStage === "ready"
      ? "Quedó lista para arrancar y el responsable del área ya la ve en monday."
      : "Quedó en Nuevas: el responsable del área la revisará y te escribirá si falta algo.";
  return (
    <EmptyState
      title="Solicitud enviada"
      description={`Entrega estimada: ${formatDay(estimate.date)} (${estimate.days} días hábiles). ${next}`}
      action={<Button variant="secondary" onClick={onAnother}>Enviar otra solicitud</Button>}
    />
  );
}
