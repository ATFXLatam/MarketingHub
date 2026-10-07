"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/arc/button/button";

/** Anyone looking at the board can start a request; /request asks for a monday sign-in first. */
export function RequestButton() {
  const router = useRouter();
  return (
    <Button size="sm" onClick={() => router.push("/request")}>
      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
      New request
    </Button>
  );
}
