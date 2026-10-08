"use client";

import type { ReactNode } from "react";
import type { PublicCampaign, PublicEvent, PublicTask } from "@/lib/public-dto";
import { TEAM_TIME_ZONE } from "@/lib/dates";
import type { TeamMember } from "@/lib/team";
import { AtfxLogo } from "@/components/brand/atfx-logo";
import { SiteFooter } from "@/components/arc/blocks/site-footer/site-footer";
import { TeamActivity } from "./team-activity";
import { TeamBoard } from "./team-board";
import { TeamCampaigns } from "./team-campaigns";
import { TeamHeader } from "./team-header";
import { TeamOverview } from "./team-overview";
import { TeamTrends } from "./team-trends";
import styles from "./team-page.module.css";

export interface TeamPageProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  /** The snapshot's team list; every widget reads it instead of deriving its own. */
  members: TeamMember[];
  campaigns: PublicCampaign[];
  /** Signed-in people with the board in monday get a shortcut to each item there; the shared link does not. */
  linkToMonday?: boolean;
  /** Server time of the snapshot, so the first render matches on server and client. */
  now: number;
  /** Today in the team's time zone. */
  today: string;
  actions: ReactNode;
}

// Same links for the team and for clients: the board in monday checks its own permissions.
const FOOTER_COLUMNS = [
  {
    title: "Requests",
    links: [
      { label: "New request", href: "/request" },
      { label: "Board in monday", href: "https://atfx.monday.com/boards/18424308173" },
    ],
  },
  {
    title: "Brand",
    links: [{ label: "atfx.com", href: "https://www.atfx.com" }],
  },
];

const UPDATED = new Intl.DateTimeFormat("en-US", {
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
  members,
  campaigns,
  linkToMonday = false,
  now,
  today,
  actions,
}: TeamPageProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <TeamHeader
          title="Marketing LATAM"
          description="Who is on what, when each request is due, and how it is moving. Statuses update from monday."
          members={members}
          actions={actions}
        />
        <TeamOverview tasks={tasks} today={today} />
        <TeamTrends tasks={tasks} activity={activity} today={today} />
        <TeamBoard tasks={tasks} members={members} linkToMonday={linkToMonday} activity={activity} now={now} today={today} />
        <TeamCampaigns campaigns={campaigns} linkToMonday={linkToMonday} />
        <TeamActivity
          tasks={tasks}
          members={members}
          activity={activity}
          now={now}
          today={today}
        />
      </main>
      <SiteFooter
        variant="columns"
        brand={{ name: "Marketing LATAM", mark: <AtfxLogo height={20} /> }}
        tagline={`Requests, load and deliveries of the ATFX LATAM marketing team. monday data as of ${UPDATED.format(now)}.`}
        columns={FOOTER_COLUMNS}
        legal={[]}
        socials={[]}
        newsletter={null}
        status={null}
        year={Number(today.slice(0, 4))}
      />
    </div>
  );
}
