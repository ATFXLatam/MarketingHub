"use client";

import { useState, useSyncExternalStore } from "react";
import { useClerk } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { Link2, Plus } from "lucide-react";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import {
  TeamDashboard,
  type TeamDashboardProps,
} from "@/components/board/team-dashboard";
import { RequestFlow } from "@/components/intake/request-flow";
import {
  applyPreference,
  readPreference,
  type ThemePreference,
} from "@/lib/theme";

const noSubscription = () => () => {};
const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

interface InternalDashboardProps extends Pick<
  TeamDashboardProps,
  "tasks" | "activity" | "now"
> {
  user: { name: string; email: string; avatarSrc?: string };
  /** Absent when PUBLIC_BOARD_TOKEN is not configured. */
  publicPath?: string;
  /** Today in the team's time zone, for the request estimate. */
  today: string;
  /** /solicitar opens the dashboard with the request flow already up, so the link can go out by email. */
  requestOpen?: boolean;
}

/** The team's dashboard: the public view plus the request action and the account menu. */
export function InternalDashboard({
  user,
  publicPath,
  today,
  requestOpen = false,
  ...board
}: InternalDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [requesting, setRequesting] = useState(requestOpen);
  const { signOut } = useClerk();
  // The stored choice only exists in the browser; hydration uses "system" like the server, then the stored value.
  const stored = useSyncExternalStore(
    noSubscription,
    readPreference,
    () => "system" as const,
  );
  const [picked, setPicked] = useState<ThemePreference | null>(null);
  const theme = picked ?? stored;

  function onRequestOpenChange(open: boolean) {
    setRequesting(open);
    if (!open && pathname !== "/") router.replace("/");
  }

  return (
    <>
      <RequestFlow
        open={requesting}
        onOpenChange={onRequestOpenChange}
        requester={user.name}
        today={today}
      />
      <TeamDashboard
        {...board}
        primaryAction={{
          label: "Nueva solicitud",
          icon: <Plus {...icon} />,
          onClick: () => setRequesting(true),
        }}
        menuActions={
          publicPath
            ? [
                {
                  key: "copy",
                  label: "Copiar enlace para clientes",
                  icon: <Link2 {...icon} />,
                  onSelect: async () => {
                    try {
                      await navigator.clipboard.writeText(
                        new URL(publicPath, window.location.origin).href,
                      );
                    } catch {
                      throw new Error(
                        "No se pudo copiar el enlace. Cópialo desde la barra de direcciones.",
                      );
                    }
                    return "Enlace copiado";
                  },
                },
              ]
            : undefined
        }
        trailing={
          <UserMenu
            user={user}
            align="end"
            theme={theme}
            onThemeChange={(next) => {
              setPicked(next);
              applyPreference(next);
            }}
            onSignOut={() => signOut({ redirectUrl: "/sign-in" })}
          />
        }
      />
    </>
  );
}
