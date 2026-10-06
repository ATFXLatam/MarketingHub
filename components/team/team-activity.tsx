"use client";

import { CalendarDays, CircleCheck, GitPullRequestArrow } from "lucide-react";
import { DonutChart } from "@/components/arc/donut-chart/donut-chart";
import { Timeline } from "@/components/arc/timeline/timeline";
import { AREA_LABEL, AREAS, STAGE_LABEL } from "@/lib/board-config";
import { formatDay, TEAM_TIME_ZONE } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { daysUntil, upcomingDeliveries } from "@/lib/team";
import { dueText } from "./team-overview";
import styles from "./team-activity.module.css";

// Areas share the accent hue at different strengths.
const AREA_SHADES = [
  "var(--accent)",
  "color-mix(in oklch, var(--accent) 72%, var(--foreground))",
  "color-mix(in oklch, var(--accent) 55%, var(--surface-muted))",
  "color-mix(in oklch, var(--accent) 38%, var(--foreground))",
];

export interface TeamActivityProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  now: number;
  today: string;
}

export function TeamActivity({ tasks, activity, now, today }: TeamActivityProps) {
  const upcoming = upcomingDeliveries(tasks);
  const byArea = AREAS.map((area, index) => ({
    key: area,
    label: AREA_LABEL[area],
    value: tasks.filter((task) => task.area === area).length,
    color: AREA_SHADES[index % AREA_SHADES.length],
  })).filter((item) => item.value > 0);

  return (
    <div className={styles.root}>
      <section className={`${styles.panel} ${styles.past}`} aria-labelledby="activity-title">
        <h2 id="activity-title" className={styles.heading}>Movimientos recientes</h2>
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
                title: done ? "se entregó" : `pasó a ${STAGE_LABEL[event.stage]}`,
                icon: done ? <CircleCheck size={14} strokeWidth={1.75} /> : <GitPullRequestArrow size={14} strokeWidth={1.75} />,
                tone: done ? ("success" as const) : ("neutral" as const),
              };
            })}
          />
        ) : (
          <p className={styles.empty}>Los cambios de estado de los últimos 30 días aparecen aquí.</p>
        )}
      </section>
      <section className={`${styles.panel} ${styles.upcomingPanel}`} aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className={styles.heading}>Próximas entregas</h2>
        {upcoming.length ? (
          <ol className={styles.upcoming}>
            {upcoming.map((task) => {
              const days = daysUntil(task.dueDate!, today);
              return (
                <li key={task.id}>
                  <span className={styles.date} data-soon={days <= 2 || undefined}>
                    <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                    <time dateTime={task.dueDate!}>{formatDay(task.dueDate!)}</time>
                  </span>
                  <span className={styles.task}>
                    <span>{task.title}</span>
                    <span className={styles.stage}>
                      {STAGE_LABEL[task.stage]} · {dueText(days)}
                      {task.owners.length > 0 && ` · ${task.owners.map((owner) => owner.name.split(" ")[0]).join(", ")}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={styles.empty}>Nada con fecha pendiente.</p>
        )}
      </section>
      <section className={`${styles.panel} ${styles.areasPanel}`} aria-labelledby="areas-title">
        <h2 id="areas-title" className={styles.heading}>Por área</h2>
        <DonutChart data={byArea} label="Solicitudes por área" unit="solicitudes" totalLabel="Total" size={168} thickness={20} otherLabel="Otras" emptyLabel="Sin solicitudes" />
      </section>
    </div>
  );
}
