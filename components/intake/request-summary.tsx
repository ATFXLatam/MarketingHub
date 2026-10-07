"use client";

import { Avatar } from "@/components/arc/avatar/avatar";
import { CheckoutSummary } from "@/components/arc/blocks/checkout-summary/checkout-summary";
import { EstimateChecklist } from "@/components/arc/blocks/usage-pricing/usage-pricing";
import type { AreaOwner } from "@/lib/area-owners";
import { AREA_LABEL, PRIORITY_LABEL, type Area, type Priority } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { BriefGap, Estimate } from "@/lib/estimate";

const TIER_NOTE: Record<Estimate["tier"], string> = {
  completo: "Brief completo",
  parcial: "Brief parcial",
  incompleto: "Brief incompleto",
};

export interface RequestSummaryProps {
  area: Area | null;
  pieceLabel?: string;
  priority: Priority;
  owner?: AreaOwner;
  result: Estimate | null;
  onFix: (gap: BriefGap) => void;
}

/** The fixed column of the request flow: what is being asked, who takes it, the date it would get now, and what is missing. */
export function RequestSummary({ area, pieceLabel, priority, owner, result, onFix }: RequestSummaryProps) {
  if (!area || !result) return <EstimateChecklist result={null} />;
  const { base, priority: faster, brief: slower, days } = result.breakdown;
  return (
    <CheckoutSummary
      title="Tu solicitud"
      item={{
        name: pieceLabel ?? "Tipo de pieza sin elegir",
        description: owner ? `${owner.assigned ? "La toma" : "Suele tomarla"} ${owner.name}` : `${AREA_LABEL[area]}, sin responsable asignado`,
        media: owner ? <Avatar name={owner.name} src={owner.photo ?? undefined} size="md" /> : undefined,
        aside: `${base} ${base === 1 ? "día" : "días"} base`,
      }}
      lines={[
        { id: "priority", label: `Prioridad ${PRIORITY_LABEL[priority].toLowerCase()}`, amount: faster, emptyLabel: "Sin cambio", note: "Adelanta la pieza en la fila" },
        { id: "brief", label: TIER_NOTE[result.tier], amount: slower, emptyLabel: "Sin días extra", costly: true, note: `${result.score} de 100 puntos` },
      ]}
      total={{ label: "Entrega estimada", value: days, unit: days === 1 ? "día hábil" : "días hábiles", note: `Para el ${formatDay(result.date)}` }}
    >
      <EstimateChecklist result={result} onFix={onFix} />
    </CheckoutSummary>
  );
}
