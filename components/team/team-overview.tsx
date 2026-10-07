"use client";

import { StatsBand, type Stat } from "@/components/arc/blocks/stats-band/stats-band";
import { Tooltip } from "@/components/arc/tooltip/tooltip";
import { STAGE_LABEL, STAGES, type Stage } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { PublicTask } from "@/lib/public-dto";
import { daysUntil, deliveriesByDate, nextDelivery } from "@/lib/team";
import styles from "./team-overview.module.css";

/** Stage colors from the theme tokens, so the strip, the board and the drawer read the same in light and dark. */
export const STAGE_TONE: Record<Stage, string> = {
  nueva: "var(--border-strong)",
  ready: "color-mix(in oklch, var(--accent) 45%, var(--surface-muted))",
  "en-curso": "var(--accent)",
  "on-hold": "var(--warning)",
  hecha: "var(--success)",
};

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

export function dueText(days: number): string {
  if (days < 0) return `${plural(-days, "day", "days")} overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${plural(days, "day", "days")}`;
}

export function TeamOverview({ tasks, today }: { tasks: PublicTask[]; today: string }) {
  const moving = tasks.filter((task) => task.stage === "en-curso");
  const done = tasks.filter((task) => task.stage === "hecha");
  const held = tasks.filter((task) => task.stage === "on-hold");
  const next = nextDelivery(tasks, today);
  const { overdue } = deliveriesByDate(tasks, today);
  const nextDays = next?.dueDate ? daysUntil(next.dueDate, today) : null;

  const stats: Stat[] = [
    { value: moving.length, label: "In progress", detail: "Requests the team is working on now", context: `${tasks.length - done.length} open in total` },
    { value: done.length, suffix: `/${tasks.length}`, label: "Delivered", detail: "In the last 30 days", context: `${plural(tasks.length - done.length, "request", "requests")} to go` },
    {
      value: held.length,
      label: "Paused",
      detail: held.length ? held.map((task) => task.title).slice(0, 2).join(", ") : "Nothing on hold",
      context: "Waiting on material or a decision",
    },
    ...(next && nextDays !== null
      ? [{ value: Math.max(nextDays, 0), suffix: nextDays === 1 ? " day" : " days", label: "Next delivery", detail: next.title, context: `${formatDay(next.dueDate!)}, ${dueText(nextDays)}` }]
      : [{ value: overdue.length, label: "Overdue", detail: overdue.length ? "No open delivery has a future date" : "No deliveries with a date", context: overdue.length ? `Oldest: ${overdue[0].title}` : "Nothing pending" }]),
  ];

  const counts = STAGES.map((stage) => ({ stage, count: tasks.filter((task) => task.stage === stage).length }));

  return (
    <section className={styles.root} aria-label="Summary">
      <StatsBand stats={stats} layout="plain" locale="en-US" className={styles.band} />
      <figure className={styles.strip}>
        <figcaption className={styles.caption}>Where the work is</figcaption>
        <div className={styles.bar} role="img" aria-label={counts.map(({ stage, count }) => `${STAGE_LABEL[stage]}: ${count}`).join(", ")}>
          {counts
            .filter(({ count }) => count > 0)
            .map(({ stage, count }) => (
              <Tooltip key={stage} content={`${STAGE_LABEL[stage]}: ${count}`}>
                <span className={styles.segment} style={{ flexGrow: count, background: STAGE_TONE[stage] }} tabIndex={0} />
              </Tooltip>
            ))}
        </div>
        <ul className={styles.legend}>
          {counts.map(({ stage, count }) => (
            <li key={stage} data-empty={count === 0 || undefined}>
              <span className={styles.swatch} style={{ background: STAGE_TONE[stage] }} aria-hidden="true" />
              {STAGE_LABEL[stage]}
              <span className={styles.count}>{count}</span>
            </li>
          ))}
        </ul>
      </figure>
    </section>
  );
}
