import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { RequestOnlyPage } from "@/components/intake/request-only-page";
import { areaOwners } from "@/lib/area-owners";
import { currentSession } from "@/lib/auth/current";
import { todayIn } from "@/lib/dates";
import { getAreaPeople } from "@/lib/monday/read";
import { configuredOwners } from "@/lib/monday/write";
import { Dashboard } from "../dashboard";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default function SolicitarPage() {
  return (
    <Suspense fallback={<Skeleton label="Cargando" lines={8} />}>
      <Request />
    </Suspense>
  );
}

async function Request() {
  const session = await currentSession();
  if (session?.board) return <Dashboard requestOpen />;
  if (!session?.canRequest) {
    return <Alert tone="warning" title="Sin acceso a solicitudes">Tu usuario de monday no puede crear solicitudes.</Alert>;
  }
  // Only the owners configured for each area: nothing read from the board itself reaches someone who cannot see it.
  const configured = Object.fromEntries(Object.entries(configuredOwners()).map(([area, ids]) => [area, ids.map(String)]));
  const known = await getAreaPeople(Object.values(configured).flat());
  return (
    <RequestOnlyPage
      user={{ name: session.name, email: session.email, avatarSrc: session.photo ?? undefined }}
      areaOwners={areaOwners([], configured, known)}
      today={todayIn()}
    />
  );
}
