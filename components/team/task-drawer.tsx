"use client";

import { CalendarDays, Clock } from "lucide-react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { Stepper } from "@/components/arc/stepper/stepper";
import { AREA_LABEL, PRIORITY_LABEL, STAGE_LABEL, type Stage } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { daysUntil } from "@/lib/team";
import { dueText } from "./team-overview";
import styles from "./task-drawer.module.css";

// On hold is a detour, not a step: it shows as a problem on "En curso" instead of a column of its own.
const PATH: Stage[] = ["nueva", "ready", "en-curso", "hecha"];
const HINT: Record<Stage, string> = {
  nueva: "El responsable revisa el brief y confirma la fecha.",
  ready: "El brief está completo; arranca en cuanto haya capacidad.",
  "en-curso": "El equipo está produciendo la pieza.",
  "on-hold": "Espera material o una decisión para seguir.",
  hecha: "Entregada.",
};

const icon = { size: 12, strokeWidth: 1.75, "aria-hidden": true } as const;

export interface TaskDrawerProps {
  task: PublicTask | null;
  history: PublicEvent[];
  today: string;
  onClose: () => void;
}

export function TaskDrawer({ task, history, today, onClose }: TaskDrawerProps) {
  return (
    <Drawer open={task !== null} onOpenChange={(open) => !open && onClose()}>
      {task && (
        <DrawerContent title={task.title} description={task.area ? `${AREA_LABEL[task.area]}${task.market ? ` · ${task.market}` : ""}` : undefined}>
          <TaskDetail task={task} history={history.filter((event) => event.taskId === task.id)} today={today} />
        </DrawerContent>
      )}
    </Drawer>
  );
}

function TaskDetail({ task, history, today }: { task: PublicTask; history: PublicEvent[]; today: string }) {
  const done = task.stage === "hecha";
  const held = task.stage === "on-hold";
  const steps = PATH.map((stage) => ({
    id: stage,
    label: STAGE_LABEL[stage],
    description: HINT[stage],
    error: held && stage === "en-curso" ? `${STAGE_LABEL["on-hold"]}: ${HINT["on-hold"]}` : undefined,
  }));
  const current = done ? PATH.length : PATH.indexOf(held ? "en-curso" : task.stage);

  return (
    <div className={styles.body}>
      <div className={styles.tags}>
        <Badge size="sm" tone={done ? "success" : held ? "warning" : "neutral"}>{STAGE_LABEL[task.stage]}</Badge>
        {task.priority && <Badge size="sm">{`Prioridad ${PRIORITY_LABEL[task.priority].toLowerCase()}`}</Badge>}
        {task.dueDate && (
          <Badge size="sm" icon={<CalendarDays {...icon} />}>
            {done ? `Pedida para el ${formatDay(task.dueDate)}` : `${formatDay(task.dueDate)}, ${dueText(daysUntil(task.dueDate, today))}`}
          </Badge>
        )}
        {task.slaDays && !done && <Badge size="sm" icon={<Clock {...icon} />}>{`${task.slaDays} días hábiles estimados`}</Badge>}
      </div>

      {task.owners.length > 0 && (
        <section className={styles.section} aria-labelledby={`${task.id}-owners`}>
          <h3 id={`${task.id}-owners`}>Responsables</h3>
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

      <section className={styles.section} aria-labelledby={`${task.id}-flow`}>
        <h3 id={`${task.id}-flow`}>Avance</h3>
        <Stepper steps={steps} current={current} orientation="vertical" details="current" label="Avance de la solicitud" completeLabel="Entregada" />
      </section>

      {history.length > 0 && (
        <section className={styles.section} aria-labelledby={`${task.id}-history`}>
          <h3 id={`${task.id}-history`}>Historial</h3>
          <ol className={styles.history}>
            {[...history].sort((a, b) => b.at.localeCompare(a.at)).map((event) => (
              <li key={event.id}>
                <span className={styles.historyStage}>Pasó a {STAGE_LABEL[event.stage]}</span>
                <time dateTime={event.at}>{formatDay(event.at.slice(0, 10))}</time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
