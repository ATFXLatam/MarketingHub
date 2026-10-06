import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { PublicBoard } from "@/components/board/public-board";
import { getBoardSnapshot } from "@/lib/monday/read";
import { safeEqual } from "@/lib/secrets";
import { PageTop } from "@/components/theme/page-top";

// The board is shared by link: anyone with PUBLIC_BOARD_TOKEN sees it, nobody can guess it, and rotating it is an env change.
export function generateStaticParams() {
  return [{ token: process.env.PUBLIC_BOARD_TOKEN ?? "sin-configurar" }];
}

export const metadata: Metadata = {
  title: "Flujo del equipo",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicBoardPage({ params }: PageProps<"/p/[token]">) {
  return (
    <main className="page">
      <PageTop title="Marketing LATAM" />
      <Suspense fallback={<Skeleton label="Cargando el tablero" lines={6} />}>
        <Board params={params} />
      </Suspense>
    </main>
  );
}

async function Board({ params }: Pick<PageProps<"/p/[token]">, "params">) {
  const { token } = await params;
  if (!safeEqual(token, process.env.PUBLIC_BOARD_TOKEN)) notFound();

  const snapshot = await getBoardSnapshot();
  if (!snapshot.configured) {
    return (
      <Alert tone="warning" title="El tablero todavía no está conectado">
        Falta configurar el acceso a monday en el servidor.
      </Alert>
    );
  }
  return <PublicBoard tasks={snapshot.tasks} activity={snapshot.activity} now={Date.parse(snapshot.fetchedAt)} />;
}
