import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Dashboard } from "../dashboard";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default function SolicitarPage() {
  return (
    <Suspense fallback={<Skeleton label="Cargando el tablero" lines={8} />}>
      <Dashboard requestOpen />
    </Suspense>
  );
}
