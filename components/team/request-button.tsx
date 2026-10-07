"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/arc/button/button";

/** The board is public, so anyone looking at it can start a request; /solicitar asks for an ATFX sign-in first. */
export function RequestButton() {
  const router = useRouter();
  return (
    <Button size="sm" onClick={() => router.push("/solicitar")}>
      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
      Nueva solicitud
    </Button>
  );
}
