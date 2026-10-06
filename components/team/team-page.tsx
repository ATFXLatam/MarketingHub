"use client";

import type { ReactNode } from "react";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { teamMembers } from "@/lib/team";
import { TeamActivity } from "./team-activity";
import { TeamBoard } from "./team-board";
import { TeamHeader } from "./team-header";
import { TeamOverview } from "./team-overview";
import styles from "./team-page.module.css";

export interface TeamPageProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  /** Server time of the snapshot, so the first render matches on server and client. */
  now: number;
  /** Today in the team's time zone. */
  today: string;
  actions: ReactNode;
}

/** The team first, then where the work stands, the board, and what moved: the same page for the team and for clients. */
export function TeamPage({ tasks, activity, now, today, actions }: TeamPageProps) {
  return (
    <main className={styles.page}>
      <TeamHeader
        title="Marketing LATAM"
        description="Quién está en qué, cuándo se entrega cada solicitud y cómo avanza. Los estados se actualizan desde monday."
        members={teamMembers(tasks)}
        actions={actions}
      />
      <TeamOverview tasks={tasks} today={today} />
      <TeamBoard tasks={tasks} activity={activity} today={today} />
      <TeamActivity tasks={tasks} activity={activity} now={now} today={today} />
    </main>
  );
}
