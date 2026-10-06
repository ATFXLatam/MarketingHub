"use client";

import { Sheet, SheetStack } from "@/components/arc/sheet-stack/sheet-stack";
import { RequestForm } from "./request-form";

const SHEET = "solicitud";

interface RequestFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requester: string;
  today: string;
}

/** The request wizard in a sheet: a centered dialog on wide screens, a bottom sheet you can drag away on phones. */
export function RequestFlow({ open, onOpenChange, requester, today }: RequestFlowProps) {
  return (
    <SheetStack stack={open ? [SHEET] : []} onStackChange={(stack) => onOpenChange(stack.length > 0)}>
      <Sheet id={SHEET} title="Nueva solicitud" description="Mientras más completo el brief, antes se puede entregar.">
        <RequestForm requester={requester} today={today} />
      </Sheet>
    </SheetStack>
  );
}
