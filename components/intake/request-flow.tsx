"use client";

import { Sheet, SheetStack } from "@/components/arc/sheet-stack/sheet-stack";
import type { AreaOwner } from "@/lib/area-owners";
import type { Area } from "@/lib/board-config";
import { RequestForm } from "./request-form";

// One height for every step, so the dialog never resizes while the person moves through the flow.
const FLOW_HEIGHT = 760;

const SHEET = "request";

interface RequestFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requester: string;
  areaOwners: Record<Area, AreaOwner[]>;
  today: string;
}

/** The request wizard in a sheet: a centered dialog on wide screens, a bottom sheet you can drag away on phones. */
export function RequestFlow({ open, onOpenChange, requester, areaOwners, today }: RequestFlowProps) {
  return (
    <SheetStack stack={open ? [SHEET] : []} onStackChange={(stack) => onOpenChange(stack.length > 0)}>
      <Sheet id={SHEET} fixedHeight={FLOW_HEIGHT} title="New request" description="The more complete the brief, the sooner it can be delivered.">
        <RequestForm requester={requester} areaOwners={areaOwners} today={today} />
      </Sheet>
    </SheetStack>
  );
}
