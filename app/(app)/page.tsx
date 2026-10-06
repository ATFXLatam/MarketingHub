import type { Metadata } from "next";
import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { InternalDashboard } from "@/components/shell/internal-dashboard";
import { isAllowedEmail } from "@/lib/access";
import { getBoardSnapshot } from "@/lib/monday/read";

export const metadata: Metadata = { title: "Marketing LATAM" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton label="Cargando el tablero" lines={8} />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const [user, snapshot] = await Promise.all([currentUser(), getBoardSnapshot()]);
  const email = user?.primaryEmailAddress?.emailAddress;
  // The layout already turns away other accounts; this only covers the page rendering alongside it.
  if (!user || !email || !isAllowedEmail(email)) return null;
  if (!snapshot.configured) {
    return (
      <Alert tone="warning" title="El tablero todavía no está conectado">
        Falta configurar el acceso a monday en el servidor.
      </Alert>
    );
  }
  const token = process.env.PUBLIC_BOARD_TOKEN;
  return (
    <InternalDashboard
      user={{ name: user.fullName?.trim() || email, email, avatarSrc: user.imageUrl }}
      publicPath={token ? `/p/${encodeURIComponent(token)}` : undefined}
      tasks={snapshot.tasks}
      activity={snapshot.activity}
      now={Date.parse(snapshot.fetchedAt)}
    />
  );
}
