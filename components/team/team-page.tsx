"use client";

import type { ReactNode } from "react";
import { Megaphone } from "lucide-react";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { TEAM_TIME_ZONE } from "@/lib/dates";
import { teamMembers } from "@/lib/team";
import { SiteFooter } from "@/components/arc/blocks/site-footer/site-footer";
import { TeamActivity } from "./team-activity";
import { TeamBoard } from "./team-board";
import { TeamHeader } from "./team-header";
import { TeamOverview } from "./team-overview";
import { TeamTrends } from "./team-trends";
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

const UPDATED = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: TEAM_TIME_ZONE,
});

/** The team first, then where the work stands, the board, and what moved: the same page for the team and for clients. */
export function TeamPage({
  tasks,
  activity,
  now,
  today,
  actions,
}: TeamPageProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <TeamHeader
          title="Marketing LATAM"
          description="Quién está en qué, cuándo se entrega cada solicitud y cómo avanza. Los estados se actualizan desde monday."
          members={teamMembers(tasks)}
          actions={actions}
        />
        <TeamOverview tasks={tasks} today={today} />
        <TeamTrends tasks={tasks} activity={activity} today={today} />
        <TeamBoard tasks={tasks} activity={activity} now={now} today={today} />
        <TeamActivity
          tasks={tasks}
          activity={activity}
          now={now}
          today={today}
        />
      </main>
      <SiteFooter
        variant="minimal"
        brand={{
          name: "ATFX Marketing LATAM",
          mark: <Megaphone size={18} strokeWidth={1.75} aria-hidden="true" />,
        }}
        tagline={`Datos de monday al ${UPDATED.format(now)}`}
        links={[]}
        legal={[]}
        socials={[]}
        newsletter={null}
        status={null}
        year={Number(today.slice(0, 4))}
      />
    </div>
  );
}
