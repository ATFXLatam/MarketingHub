import type { Metadata } from "next";
import { DEFAULT_AVATAR } from "@/lib/board-config";
import { Suspense } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { BoardLoader } from "@/components/shell/board-loader";
import { RequestOnlyPage } from "@/components/intake/request-only-page";
import { areaOwners } from "@/lib/area-owners";
import { currentSession } from "@/lib/auth/current";
import { todayIn } from "@/lib/dates";
import { getAreaPeople } from "@/lib/monday/read";
import { configuredOwners } from "@/lib/monday/write";
import { Dashboard } from "../dashboard";

export const metadata: Metadata = { title: "New request" };

export default function SolicitarPage() {
  return (
    <Suspense fallback={<BoardLoader label="Loading the request form" />}>
      <Request />
    </Suspense>
  );
}

async function Request() {
  const session = await currentSession();
  if (session?.board) return <Dashboard requestOpen />;
  if (!session?.canRequest) {
    return <Alert tone="warning" title="No access to requests">Your monday user cannot create requests.</Alert>;
  }
  // Only the owners configured for each area: nothing read from the board itself reaches someone who cannot see it.
  const configured = Object.fromEntries(Object.entries(configuredOwners()).map(([area, ids]) => [area, ids.map(String)]));
  const known = await getAreaPeople(Object.values(configured).flat());
  return (
    <RequestOnlyPage
      user={{ name: session.name, email: session.email, avatarSrc: session.photo ?? DEFAULT_AVATAR }}
      areaOwners={areaOwners([], configured, known)}
      today={todayIn()}
    />
  );
}
