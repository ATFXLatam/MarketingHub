"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Link2, Plus } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { RequestFlow } from "@/components/intake/request-flow";
import { TeamPage, type TeamPageProps } from "@/components/team/team-page";
import type { AreaOwner } from "@/lib/area-owners";
import type { Area } from "@/lib/board-config";
import { applyPreference, readPreference, type ThemePreference } from "@/lib/theme";

const noSubscription = () => () => {};
const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const COPIED_MS = 2000;

interface InternalDashboardProps extends Omit<TeamPageProps, "actions"> {
  user: { name: string; email: string; avatarSrc?: string };
  /** Absent when PUBLIC_BOARD_TOKEN is not configured. */
  publicPath?: string;
  /** /solicitar opens the dashboard with the request flow already up, so the link can go out by email. */
  requestOpen?: boolean;
  areaOwners: Record<Area, AreaOwner[]>;
  /** Viewer seats see the board but cannot request work. */
  canRequest: boolean;
}

/** The team's page plus what only the team does: request work, share the client link, and the account menu. */
export function InternalDashboard({ user, publicPath, requestOpen = false, areaOwners, canRequest, ...page }: InternalDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [requesting, setRequesting] = useState(requestOpen && canRequest);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  // The stored choice only exists in the browser; hydration uses "system" like the server, then the stored value.
  const stored = useSyncExternalStore(noSubscription, readPreference, () => "system" as const);
  const [picked, setPicked] = useState<ThemePreference | null>(null);
  const theme = picked ?? stored;

  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  function onRequestOpenChange(open: boolean) {
    setRequesting(open);
    if (!open && pathname !== "/") router.replace("/");
  }

  async function copyLink() {
    if (!publicPath) return;
    try {
      await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <>
      {canRequest && <RequestFlow open={requesting} onOpenChange={onRequestOpenChange} requester={user.name} areaOwners={areaOwners} today={page.today} />}
      <TeamPage
        {...page}
        actions={
          <>
            {publicPath && (
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied === "done" ? <Check {...icon} /> : <Link2 {...icon} />}
                {copied === "done" ? "Enlace copiado" : copied === "failed" ? "No se pudo copiar" : "Enlace para clientes"}
              </Button>
            )}
            {canRequest && (
              <Button size="sm" onClick={() => setRequesting(true)}>
                <Plus {...icon} />
                Nueva solicitud
              </Button>
            )}
            <UserMenu
              user={user}
              align="end"
              theme={theme}
              onThemeChange={(next) => {
                setPicked(next);
                applyPreference(next);
              }}
              onSignOut={() => void fetch("/api/monday/oauth/logout", { method: "POST" }).finally(() => router.replace("/sign-in"))}
            />
          </>
        }
      />
    </>
  );
}
