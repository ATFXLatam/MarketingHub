import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardLoader } from "@/components/shell/board-loader";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Marketing LATAM" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<BoardLoader />}>
      <Dashboard />
    </Suspense>
  );
}
