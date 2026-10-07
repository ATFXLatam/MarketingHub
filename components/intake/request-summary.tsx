"use client";

import { Avatar } from "@/components/arc/avatar/avatar";
import { CheckoutSummary } from "@/components/arc/blocks/checkout-summary/checkout-summary";
import { EstimateChecklist } from "@/components/arc/blocks/usage-pricing/usage-pricing";
import type { AreaOwner } from "@/lib/area-owners";
import { AREA_LABEL, PRIORITY_LABEL, type Area, type Priority } from "@/lib/board-config";
import type { BriefGap, Estimate } from "@/lib/estimate";

// Enough to act on now; the rest is counted so the column never needs to scroll.
const MISSING_SHOWN = 3;

const TIER_NOTE: Record<Estimate["tier"], string> = {
  completo: "Complete, no waiting",
  parcial: "Partial, more back and forth",
  incompleto: "Incomplete, we will ask for what is missing",
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
  const { base, priority: faster, brief: slower } = result.breakdown;
  return (
    <CheckoutSummary
      title="Your request"
      item={{
        name: pieceLabel ?? "Piece type not chosen",
        description: owner ? `${owner.assigned ? `${owner.name} takes it` : `Usually ${owner.name}`}` : `${AREA_LABEL[area]}, no owner assigned`,
        media: owner ? <Avatar name={owner.name} src={owner.photo ?? undefined} size="md" /> : undefined,
        aside: `${base} base ${base === 1 ? "day" : "days"}`,
      }}
      lines={[
        { id: "priority", label: `${PRIORITY_LABEL[priority]} priority`, amount: faster, emptyLabel: "No change", note: "Moves the piece up the queue" },
        { id: "brief", label: "Brief adjustment", amount: slower, emptyLabel: "No extra days", costly: true, note: TIER_NOTE[result.tier] },
      ]}
      surface="none"
    >
      <EstimateChecklist result={result} onFix={onFix} limit={MISSING_SHOWN} />
    </CheckoutSummary>
  );
}
