"use client";

import { CalendarDays, CircleCheck, Clock, GitPullRequestArrow } from "lucide-react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { Stepper } from "@/components/arc/stepper/stepper";
import { Timeline } from "@/components/arc/timeline/timeline";
import { AREA_LABEL, PRIORITY_LABEL, SOURCE_LABEL, STAGE_LABEL, type Stage } from "@/lib/board-config";
import { formatDay, TEAM_TIME_ZONE } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { daysUntil } from "@/lib/team";
import { TaskConversation } from "./task-conversation";
import { dueText } from "./team-overview";
import styles from "./task-drawer.module.css";

// On hold is a detour, not a step: it shows as a problem on "In progress" instead of a column of its own.
const PATH: Stage[] = ["nueva", "ready", "en-curso", "hecha"];
const HINT: Record<Stage, string> = {
  nueva: "Brief under review",
  ready: "Waiting for capacity",
  "en-curso": "In production",
  "on-hold": "Waiting on material or a decision",
  hecha: "Delivered",
};

const icon = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const;

export interface TaskDrawerProps {
  task: PublicTask | null;
  history: PublicEvent[];
  now: number;
  today: string;
  onClose: () => void;
}

export function TaskDrawer({ task, history, now, today, onClose }: TaskDrawerProps) {
  return (
    <Drawer open={task !== null} onOpenChange={(open) => !open && onClose()}>
      {task && (
        <DrawerContent title={task.title} description={task.area ? `${AREA_LABEL[task.area]}${task.market ? ` · ${task.market}` : ""}` : SOURCE_LABEL[task.source]}>
          <TaskDetail task={task} history={history.filter((event) => event.taskId === task.id)} now={now} today={today} />
        </DrawerContent>
      )}
    </Drawer>
  );
}

function TaskDetail({ task, history, now, today }: { task: PublicTask; history: PublicEvent[]; now: number; today: string }) {
  const done = task.stage === "hecha";
  const held = task.stage === "on-hold";
  const current = done ? PATH.length : PATH.indexOf(held ? "en-curso" : task.stage);
  // A step reached earlier shows the day it was reached, so the stepper reads as the request's dates at a glance.
  const reached = (stage: Stage) => history.filter((event) => event.stage === stage).map((event) => event.at).sort().at(-1);
  const steps = PATH.map((stage, index) => {
    const at = reached(stage);
    return {
      id: stage,
      label: STAGE_LABEL[stage],
      description: index < current && at ? formatDay(at.slice(0, 10)) : index === current ? HINT[stage] : undefined,
      error: held && stage === "en-curso" ? HINT["on-hold"] : undefined,
    };
  });

  return (
    <div className={styles.body}>
      <section className={styles.section} aria-label="Status">
        <div className={styles.tags}>
        <Badge size="sm" tone={done ? "success" : held ? "warning" : "neutral"}>{STAGE_LABEL[task.stage]}</Badge>
        {task.priority && <Badge size="sm">{`${PRIORITY_LABEL[task.priority]} priority`}</Badge>}
        {task.dueDate && (
          <Badge size="sm" icon={<CalendarDays {...icon} />}>
            {done ? `Requested for ${formatDay(task.dueDate)}` : `${formatDay(task.dueDate)}, ${dueText(daysUntil(task.dueDate, today))}`}
          </Badge>
        )}
        {task.slaDays && !done && <Badge size="sm" icon={<Clock {...icon} />}>{`${task.slaDays} business ${task.slaDays === 1 ? "day" : "days"} estimated`}</Badge>}
      </div>

        <Stepper steps={steps} current={current} details="all" label="Request progress" completeLabel="Delivered" />
      </section>

      <TaskConversation key={task.id} taskId={task.id} />

      {task.owners.length > 0 && (
        <section className={styles.section} aria-labelledby={`${task.id}-owners`}>
          <h3 id={`${task.id}-owners`}>Owners</h3>
          <ul className={styles.owners}>
            {task.owners.map((owner) => (
              <li key={owner.id}>
                <Avatar name={owner.name} src={owner.photo ?? undefined} size="md" />
                <span className={styles.owner}>
                  <span>{owner.name}</span>
                  {owner.title && <span className={styles.muted}>{owner.title}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className={styles.section} aria-labelledby={`${task.id}-history`}>
          <h3 id={`${task.id}-history`}>History</h3>
          <Timeline
            label="Request history"
            now={now}
            timeZone={TEAM_TIME_ZONE}
            scrollToNew={false}
            headingLevel={4}
            events={history.map((event) => {
              const delivered = event.stage === "hecha";
              return {
                id: event.id,
                at: event.at,
                title: delivered ? "Delivered" : `Moved to ${STAGE_LABEL[event.stage]}`,
                icon: delivered ? <CircleCheck size={14} strokeWidth={1.75} /> : <GitPullRequestArrow size={14} strokeWidth={1.75} />,
                tone: delivered ? ("success" as const) : ("neutral" as const),
              };
            })}
          />
        </section>
      )}
    </div>
  );
}
