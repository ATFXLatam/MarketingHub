"use client";

import type { ReactNode } from "react";
import type { PublicCampaign, PublicEvent, PublicTask } from "@/lib/public-dto";
import { TEAM_TIME_ZONE } from "@/lib/dates";
import { deliveriesByDate, scopeToPerson, type TeamMember } from "@/lib/team";
import { AtfxLogo } from "@/components/brand/atfx-logo";
import { SiteFooter } from "@/components/arc/blocks/site-footer/site-footer";
import { ScopeBar } from "./scope-bar";
import { Section } from "./section";
import { TeamDeliveries, TeamFeed, TeamRings } from "./team-activity";
import activityStyles from "./team-activity.module.css";
import { TeamBoard } from "./team-board";
import { TeamCampaigns } from "./team-campaigns";
import { TeamHeader } from "./team-header";
import { TeamOverview } from "./team-overview";
import { TeamTrends } from "./team-trends";
import { PERSON_PARAM, useUrlParam } from "./url-state";
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

/** Folded, the subtitle is all that shows, so it carries the counts that make someone open the block. */
function dueSummary(who: string, tasks: PublicTask[], today: string): string {
  const { overdue, upcoming } = deliveriesByDate(tasks, today);
  if (!overdue.length && !upcoming.length) return `${who} open work has no due dates pending.`;
  return `${who} open work: ${overdue.length} overdue, ${upcoming.length} upcoming.`;
}

/** Ordered by what someone acts on: who, what is due, where the work stands, the board, then trends. Same page for the team and for clients. */
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
  const personId = useUrlParam(PERSON_PARAM);
  const person = members.find((member) => member.id === personId);
  const scoped = scopeToPerson(tasks, activity, person?.id ?? null);
  const who = person ? `${person.name.split(" ")[0]}'s` : "The team's";
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <TeamHeader
          title="Marketing LATAM"
          description="Who is on what, when each request is due, and how it is moving. Statuses update from monday."
          members={members}
          actions={actions}
        />
        {person && <ScopeBar person={person} />}
        <Section
          title="Due dates"
          subtitle={dueSummary(who, scoped.tasks, today)}
          hint="Overdue work comes first. Pull the list down to refresh. Status changes come from monday."
          collapsible
        >
          <div className={activityStyles.due}>
            <TeamDeliveries tasks={scoped.tasks} person={person} today={today} />
            <TeamFeed activity={scoped.activity} now={now} />
          </div>
        </Section>
        <Section
          title="At a glance"
          subtitle={`${who} work across every board, by stage.`}
          hint="Delivered counts the last 30 days. The bar shows where the open work sits; hover a segment for its count."
        >
          <TeamOverview tasks={scoped.tasks} today={today} />
        </Section>
        <TeamBoard tasks={tasks} members={members} linkToMonday={linkToMonday} activity={activity} now={now} today={today} />
        <TeamCampaigns campaigns={campaigns} today={today} linkToMonday={linkToMonday} />
        <Section
          title="Pace and progress"
          subtitle="Requests in, moves and deliveries per day, and how each person is tracking."
          hint="Trends compare each range with the period before it. Rings show delivered, on time and in progress shares."
          collapsible
        >
          {/* Trends and rings answer "how are we doing over time", a second read, so they wait folded until asked for. */}
          <div className={activityStyles.pace}>
            <TeamTrends tasks={scoped.tasks} activity={scoped.activity} today={today} />
            <TeamRings members={members} person={person} today={today} />
          </div>
        </Section>
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
