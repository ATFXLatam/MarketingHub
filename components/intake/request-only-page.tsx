"use client";

import { Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import type { AreaOwner } from "@/lib/area-owners";
import type { Area } from "@/lib/board-config";
import { applyPreference, readPreference, type ThemePreference } from "@/lib/theme";
import { RequestForm } from "./request-form";
import styles from "./request-only-page.module.css";

const noSubscription = () => () => {};

export interface RequestOnlyPageProps {
  user: { name: string; email: string; avatarSrc?: string };
  areaOwners: Record<Area, AreaOwner[]>;
  today: string;
}

/** For people whose monday user does not see the requests board: they can ask for work, nothing else of the board shows. */
export function RequestOnlyPage({ user, areaOwners, today }: RequestOnlyPageProps) {
  const router = useRouter();
  const stored = useSyncExternalStore(noSubscription, readPreference, () => "system" as const);
  const [picked, setPicked] = useState<ThemePreference | null>(null);
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>
          <Megaphone size={18} strokeWidth={1.75} aria-hidden="true" />
          Marketing LATAM
        </span>
        <UserMenu
          user={user}
          align="end"
          theme={picked ?? stored}
          onThemeChange={(next) => {
            setPicked(next);
            applyPreference(next);
          }}
          onSignOut={() => void fetch("/api/monday/oauth/logout", { method: "POST" }).finally(() => router.replace("/sign-in"))}
        />
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>New request</h1>
        <p className={styles.description}>The more complete the brief, the sooner it can be delivered.</p>
        <div className={styles.frame}>
          <RequestForm requester={user.name} areaOwners={areaOwners} today={today} />
        </div>
      </main>
    </div>
  );
}
