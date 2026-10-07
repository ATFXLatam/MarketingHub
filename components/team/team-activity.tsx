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
  upcomingDeliveries,
} from "@/lib/team";
import { dueText } from "./team-overview";
import styles from "./team-activity.module.css";

// Long enough that the spinner reads as work, not a flicker.
const REFRESH_MIN_MS = 600;

const SHARES = [
  {
    id: "entregadas",
    label: "Entregadas",
    unit: "",
    goal: 100,
    color: "var(--success)",
  },
  { id: "alDia", label: "Al día", unit: "", goal: 100, color: "var(--accent)" },
  {
    id: "enCurso",
    label: "En curso",
    unit: "",
    goal: 100,
    color: "var(--warning)",
  },
];

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
    return "Al día";
  }
  const upcoming = upcomingDeliveries(tasks);
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
          Movimientos recientes
        </h2>
        {activity.length ? (
          <Timeline
            label="Movimientos recientes"
            now={now}
            locale="es-MX"
            timeZone={TEAM_TIME_ZONE}
            scrollToNew={false}
            maxHeight={620}
            events={activity.map((event) => {
              const done = event.stage === "hecha";
              return {
                id: event.id,
                at: event.at,
                actor: event.taskTitle,
                title: done
                  ? "se entregó"
                  : `pasó a ${STAGE_LABEL[event.stage]}`,
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
            Los cambios de estado de los últimos 60 días aparecen aquí.
          </p>
        )}
      </section>
      <StretchRefresh
        className={styles.upcomingPanel}
        title="Próximas entregas"
        subtitle={
          upcoming.length
            ? `${upcoming.length} con fecha`
            : "Nada con fecha pendiente"
        }
        items={upcoming}
        getKey={(task) => task.id}
        onRefresh={refresh}
        renderItem={(task) => {
          const days = daysUntil(task.dueDate!, today);
          return (
            <div className={styles.upcomingRow}>
              <span className={styles.date} data-soon={days <= 2 || undefined}>
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
          Por persona
        </h2>
        {people.length ? (
          <ActivityRings
            metrics={SHARES}
            days={people}
            defaultDay={people[0].id}
            label="Avance por persona"
            pickerLabel="Persona"
          />
        ) : (
          <p className={styles.empty}>Nadie tiene solicitudes asignadas.</p>
        )}
      </section>
    </div>
  );
}
