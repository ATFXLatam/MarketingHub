import { currentUser } from "@clerk/nextjs/server";
import { Alert } from "@/components/arc/alert/alert";
import { InternalDashboard } from "@/components/shell/internal-dashboard";
import { isAllowedEmail } from "@/lib/access";
import { todayIn } from "@/lib/dates";
import { areaOwners } from "@/lib/area-owners";
import { getAreaPeople, getBoardSnapshot } from "@/lib/monday/read";
import { configuredOwners } from "@/lib/monday/write";

/** Shared by / and /solicitar; the second only opens the request flow on arrival. */
export async function Dashboard({ requestOpen = false }: { requestOpen?: boolean }) {
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
  const configured = Object.fromEntries(Object.entries(configuredOwners()).map(([area, ids]) => [area, ids.map(String)]));
  const known = await getAreaPeople(Object.values(configured).flat());
  const token = process.env.PUBLIC_BOARD_TOKEN;
  return (
    <InternalDashboard
      user={{ name: user.fullName?.trim() || email, email, avatarSrc: user.imageUrl }}
      publicPath={token ? `/p/${encodeURIComponent(token)}` : undefined}
      today={todayIn()}
      requestOpen={requestOpen}
      areaOwners={areaOwners(snapshot.tasks, configured, known)}
      tasks={snapshot.tasks}
      activity={snapshot.activity}
      roster={snapshot.roster}
      now={Date.parse(snapshot.fetchedAt)}
    />
  );
}
