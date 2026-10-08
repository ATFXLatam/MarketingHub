"use client";

import { CalendarDays, CircleCheck, GitPullRequestArrow } from "lucide-react";
import { useRouter } from "next/navigation";
import { StretchRefresh } from "@/components/arc/stretch-refresh/stretch-refresh";
import { ActivityRings } from "@/components/arc/activity-rings/activity-rings";
import { Timeline } from "@/components/arc/timeline/timeline";
import { STAGE_LABEL } from "@/lib/board-config";
import { formatDay, TEAM_TIME_ZONE } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import {
  daysUntil,
  memberShares,
  teamMembers,
  deliveriesByDate,
} from "@/lib/team";
import { dueText } from "./team-overview";
import styles from "./team-activity.module.css";
import { PERSON_PARAM, useUrlParam } from "./url-state";

// Long enough that the spinner reads as work, not a flicker.
const REFRESH_MIN_MS = 600;

const SHARES = [
  {
    id: "entregadas",
    label: "Delivered",
    unit: "",
    goal: 100,
    color: "var(--success)",
  },
  { id: "alDia", label: "On time", unit: "", goal: 100, color: "var(--accent)" },
  {
    id: "enCurso",
    label: "In progress",
    unit: "",
    goal: 100,
    color: "var(--warning)",
  },
];

type DeliveryRow =
  | PublicTask
  | { kind: "group"; id: string; label: string; count: number; late: boolean };

export interface TeamActivityProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  now: number;
  today: string;
}

export function TeamActivity({
  tasks,
  activity,
  now,
  today,
}: TeamActivityProps) {
  const router = useRouter();
  // Re-reads the cached snapshot the monday webhook keeps current; it never calls monday itself, so pulling cannot burn API quota.
  async function refresh() {
    router.refresh();
    await new Promise((resolve) => setTimeout(resolve, REFRESH_MIN_MS));
    return "Up to date";
  }
  const personId = useUrlParam(PERSON_PARAM);
  const person = tasks.flatMap((task) => task.owners).find((owner) => owner.id === personId);
  const mine = person ? tasks.filter((task) => task.owners.some((owner) => owner.id === personId)) : tasks;
  const { overdue, upcoming } = deliveriesByDate(mine, today);
  // Overdue work leads and never collapses: it is what someone has to act on first.
  const rows: DeliveryRow[] = [
    ...(overdue.length
      ? [
          {
            kind: "group" as const,
            id: "vencidas",
            label: "Overdue",
            count: overdue.length,
            late: true,
          },
          ...overdue,
        ]
      : []),
    ...(upcoming.length
      ? [
          {
            kind: "group" as const,
            id: "proximas",
            label: "Upcoming",
            count: upcoming.length,
            late: false,
          },
          ...upcoming,
        ]
      : []),
  ];
  // One ring set per person: the picker under the dial switches between people instead of days.
  const people = teamMembers(tasks).map((member) => ({
    id: member.id,
    label: member.name,
    short: member.name.split(" ")[0],
    values: memberShares(member, today),
  }));

  return (
    <div className={styles.root}>
      <section
        className={`${styles.panel} ${styles.past}`}
        aria-labelledby="activity-title"
      >
        <h2 id="activity-title" className={styles.heading}>
          Recent activity
        </h2>
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
                title: done
                  ? "delivered"
                  : `moved to ${STAGE_LABEL[event.stage]}`,
                icon: done ? (
                  <CircleCheck size={14} strokeWidth={1.75} />
                ) : (
                  <GitPullRequestArrow size={14} strokeWidth={1.75} />
                ),
                tone: done ? ("success" as const) : ("neutral" as const),
              };
            })}
          />
        ) : (
          <p className={styles.empty}>
            Status changes from the last 60 days appear here.
          </p>
        )}
      </section>
      <StretchRefresh
        className={styles.upcomingPanel}
        title={person ? `${person.name.split(" ")[0]}'s deliveries` : "Deliveries"}
        subtitle={
          overdue.length
            ? `${overdue.length} overdue · ${upcoming.length} upcoming`
            : upcoming.length
              ? `${upcoming.length} upcoming`
              : "Nothing pending with a due date"
        }
        items={rows}
        getKey={(row) => row.id}
        onRefresh={refresh}
        renderItem={(row) => {
          if ("kind" in row) {
            return (
              <h3 className={styles.group} data-late={row.late || undefined}>
                {row.label}{" "}
                <span className={styles.groupCount}>{row.count}</span>
              </h3>
            );
          }
          const task = row;
          const days = daysUntil(task.dueDate!, today);
          return (
            <div className={styles.upcomingRow}>
              <span
                className={styles.date}
                data-late={days < 0 || undefined}
                data-soon={(days >= 0 && days <= 2) || undefined}
              >
                <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                <time dateTime={task.dueDate!}>{formatDay(task.dueDate!)}</time>
              </span>
              <span className={styles.task}>
                <span>{task.title}</span>
                <span className={styles.stage}>
                  {STAGE_LABEL[task.stage]} · {dueText(days)}
                  {task.owners.length > 0 &&
                    ` · ${task.owners.map((owner) => owner.name.split(" ")[0]).join(", ")}`}
                </span>
              </span>
            </div>
          );
        }}
      />
      <section
        className={`${styles.panel} ${styles.areasPanel}`}
        aria-labelledby="areas-title"
      >
        <h2 id="areas-title" className={styles.heading}>
          By person
        </h2>
        {people.length ? (
          <ActivityRings
            metrics={SHARES}
            days={people}
            defaultDay={people[0].id}
            label="Progress by person"
            pickerLabel="Person"
          />
        ) : (
          <p className={styles.empty}>No one has requests assigned.</p>
        )}
      </section>
    </div>
  );
}
