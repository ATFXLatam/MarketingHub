"use client";

import { CalendarDays, CircleCheck, GitPullRequestArrow } from "lucide-react";
import { useRouter } from "next/navigation";
import { StretchRefresh } from "@/components/arc/stretch-refresh/stretch-refresh";
import { ActivityRings } from "@/components/arc/activity-rings/activity-rings";
import { Timeline } from "@/components/arc/timeline/timeline";
import { STAGE_LABEL } from "@/lib/board-config";
import { formatDay, TEAM_TIME_ZONE } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { daysUntil, memberShares, deliveriesByDate, type TeamMember } from "@/lib/team";
import { dueText } from "./team-overview";
import styles from "./team-activity.module.css";

// Long enough that the spinner reads as work, not a flicker.
const REFRESH_MIN_MS = 600;

const SHARES = [
  { id: "entregadas", label: "Delivered", unit: "", goal: 100, color: "var(--success)" },
  { id: "alDia", label: "On time", unit: "", goal: 100, color: "var(--accent)" },
  { id: "enCurso", label: "In progress", unit: "", goal: 100, color: "var(--warning)" },
];

type DeliveryRow = PublicTask | { kind: "group"; id: string; label: string; count: number; late: boolean };

const firstName = (name: string) => name.split(" ")[0];

/** Open work with a date, overdue first: the list someone acts on when they open the page. */
export function TeamDeliveries({ tasks, person, today }: { tasks: PublicTask[]; person?: TeamMember; today: string }) {
  const router = useRouter();
  // Re-reads the cached snapshot the monday webhook keeps current; it never calls monday itself, so pulling cannot burn API quota.
  async function refresh() {
    router.refresh();
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MIN_MS));
    return "Up to date";
  }
  const { overdue, upcoming } = deliveriesByDate(tasks, today);
  // Overdue work leads and never collapses: it is what someone has to act on first.
  const rows: DeliveryRow[] = [
    ...(overdue.length ? [{ kind: "group" as const, id: "vencidas", label: "Overdue", count: overdue.length, late: true }, ...overdue] : []),
    ...(upcoming.length ? [{ kind: "group" as const, id: "proximas", label: "Upcoming", count: upcoming.length, late: false }, ...upcoming] : []),
  ];
  return (
    <StretchRefresh
      className={styles.upcomingPanel}
      title={person ? `${firstName(person.name)}'s deliveries` : "Deliveries"}
      subtitle={
        overdue.length ? `${overdue.length} overdue · ${upcoming.length} upcoming` : upcoming.length ? `${upcoming.length} upcoming` : "Nothing pending with a due date"
      }
      items={rows}
      getKey={(row) => row.id}
      onRefresh={refresh}
      renderItem={(row) => {
        if ("kind" in row) {
          return (
            <h3 className={styles.group} data-late={row.late || undefined}>
              {row.label} <span className={styles.groupCount}>{row.count}</span>
            </h3>
          );
        }
        const days = daysUntil(row.dueDate!, today);
        return (
          <div className={styles.upcomingRow}>
            <span className={styles.date} data-late={days < 0 || undefined} data-soon={(days >= 0 && days <= 2) || undefined}>
              <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
              <time dateTime={row.dueDate!}>{formatDay(row.dueDate!)}</time>
            </span>
            <span className={styles.task}>
              <span>{row.title}</span>
              <span className={styles.stage}>
                {STAGE_LABEL[row.stage]} · {dueText(days)}
                {row.owners.length > 0 && ` · ${row.owners.map((owner) => firstName(owner.name)).join(", ")}`}
              </span>
            </span>
          </div>
        );
      }}
    />
  );
}

/** Status changes as they happened, newest first. */
export function TeamFeed({ activity, now }: { activity: PublicEvent[]; now: number }) {
  return (
    <section className={`${styles.panel} ${styles.past}`} aria-label="Recent activity">
      {activity.length ? (
        <Timeline
          label="Recent activity"
          now={now}
          locale="en-US"
          timeZone={TEAM_TIME_ZONE}
          scrollToNew={false}
          className={styles.feed}
          maxHeight="var(--feed-height)"
          events={activity.map((event) => {
            const done = event.stage === "hecha";
            return {
              id: event.id,
              at: event.at,
              actor: event.taskTitle,
              title: done ? "delivered" : `moved to ${STAGE_LABEL[event.stage]}`,
              icon: done ? <CircleCheck size={14} strokeWidth={1.75} /> : <GitPullRequestArrow size={14} strokeWidth={1.75} />,
              tone: done ? ("success" as const) : ("neutral" as const),
            };
          })}
        />
      ) : (
        <p className={styles.empty}>Status changes from the last 60 days appear here.</p>
      )}
    </section>
  );
}

/** One ring set per person: the picker under the dial switches between people instead of days. */
export function TeamRings({ members, person, today }: { members: TeamMember[]; person?: TeamMember; today: string }) {
  const people = members.map((member) => ({ id: member.id, label: member.name, short: firstName(member.name), values: memberShares(member, today) }));
  return (
    <section className={styles.panel} aria-label="Progress by person">
      {people.length ? (
        <ActivityRings
          key={person?.id ?? "all"}
          metrics={SHARES}
          days={people}
          defaultDay={person?.id ?? people[0].id}
          label="Progress by person"
          pickerLabel="Person"
        />
      ) : (
        <p className={styles.empty}>No one has requests assigned.</p>
      )}
    </section>
  );
}
