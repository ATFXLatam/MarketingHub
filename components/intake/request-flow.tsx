"use client";

import { useSyncExternalStore } from "react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { RequestForm } from "./request-form";

// Matches the drawer's own breakpoint: below it the drawer already takes the full width.
const WIDE = "(min-width: 40rem)";
const TITLE = "Nueva solicitud";
const DESCRIPTION = "Mientras más completo el brief, antes se puede entregar.";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

interface RequestFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requester: string;
  today: string;
}

/** The request wizard as a modal on wide screens and as a drawer on phones, where a centered modal leaves no room to type. */
export function RequestFlow({ open, onOpenChange, requester, today }: RequestFlowProps) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => true);
  const form = <RequestForm requester={requester} today={today} />;
  return wide ? (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="wide" title={TITLE} description={DESCRIPTION}>
        {form}
      </DialogContent>
    </Dialog>
  ) : (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" title={TITLE} description={DESCRIPTION}>
        {form}
      </DrawerContent>
    </Drawer>
  );
}
