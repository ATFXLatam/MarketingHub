"use client";

import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { PageHeader, PageHeaderOverview, type PageHeaderMenuAction, type PageHeaderProps } from "@/components/arc/blocks/page-header/page-header";
import { ProjectBoard } from "@/components/arc/blocks/project-board/project-board";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { Timeline } from "@/components/arc/timeline/timeline";
import { AREA_LABEL, AREAS, PRIORITY_LABEL, STAGE_LABEL, STAGES, type Priority, type Stage } from "@/lib/board-config";
import { boardMetrics } from "@/lib/board-metrics";
import { formatDay, TEAM_TIME_ZONE } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { normal: "neutral", media: "info", alta: "warning", critica: "danger" };
const STAGE_STATE: Record<Stage, "done" | "active" | "planned"> = { nueva: "planned", ready: "planned", "en-curso": "active", "on-hold": "planned", hecha: "done" };
const DAY_MS = 24 * 60 * 60 * 1000;

type Row = { id: string; title: string; area: string; stage: string; stageOrder: number; priority: Priority | null; dueDate: string };

const TABLE_COLUMNS: DataColumn<Row>[] = [
  { key: "title", label: "Solicitud", sortable: true },
  { key: "area", label: "Área", sortable: true },
  { key: "stageOrder", label: "Estado", sortable: true, render: (_, row) => row.stage },
  {
    key: "priority",
    label: "Prioridad",
    render: (_, row) => (row.priority ? <Badge size="sm" tone={PRIORITY_TONE[row.priority]}>{PRIORITY_LABEL[row.priority]}</Badge> : null),
  },
  { key: "dueDate", label: "Fecha requerida", sortable: true, render: (_, row) => (row.dueDate ? formatDay(row.dueDate) : "Sin fecha") },
];

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

export interface TeamDashboardProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  /** Server time of the snapshot, so the first render matches on server and client. */
  now: number;
  primaryAction?: PageHeaderProps["primaryAction"];
  menuActions?: PageHeaderMenuAction[];
  trailing?: ReactNode;
}

/** The team's flow on one page: the same view for the team and, read only, for clients. */
export function TeamDashboard({ tasks, activity, now, primaryAction, menuActions, trailing }: TeamDashboardProps) {
  const metrics = boardMetrics(tasks);
  const open = tasks.filter((task) => task.stage !== "hecha");
  const onHold = tasks.filter((task) => task.stage === "on-hold").length;

  const empty = <EmptyState title="Sin solicitudes" description="Cuando el equipo reciba la primera solicitud aparecerá aquí." />;
  const rows: Row[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    area: task.area ? AREA_LABEL[task.area] : "Sin área",
    stage: STAGE_LABEL[task.stage],
    stageOrder: STAGES.indexOf(task.stage),
    priority: task.priority,
    dueDate: task.dueDate ?? "",
  }));

  return (
    <PageHeader
      crumbs={["ATFX"]}
      title="Marketing LATAM"
      description="En qué está trabajando el equipo y cuándo se entrega cada solicitud. Los estados se actualizan desde monday."
      status={onHold > 0 ? { tone: "warning", label: plural(onHold, "en pausa", "en pausa") } : { tone: "success", label: "Al día" }}
      meta={[
        plural(open.length, "solicitud abierta", "solicitudes abiertas"),
        metrics.averageSla ? `Entrega promedio de ${plural(metrics.averageSla, "día hábil", "días hábiles")}` : "Sin estimaciones abiertas",
      ]}
      primaryAction={primaryAction}
      menuActions={menuActions}
      trailing={trailing}
      sections={[
        {
          value: "resumen",
          label: "Resumen",
          content: tasks.length === 0 ? empty : (
            <PageHeaderOverview
              progress={{ value: metrics.done, max: tasks.length, label: `${metrics.done} de ${tasks.length} hechas en los últimos 30 días` }}
              milestonesTitle="Por estado"
              milestones={STAGES.map((stage) => ({
                key: stage,
                name: STAGE_LABEL[stage],
                note: plural(tasks.filter((task) => task.stage === stage).length, "solicitud", "solicitudes"),
                state: STAGE_STATE[stage],
              }))}
            />
          ),
        },
        {
          value: "tablero",
          label: "Tablero",
          count: open.length,
          content: tasks.length === 0 ? empty : (
            <ProjectBoard
              title="Flujo del equipo"
              doneStage="hecha"
              stages={STAGES.map((stage) => ({ id: stage, label: STAGE_LABEL[stage] }))}
              filters={[{ value: "todas", label: "Todas" }, ...AREAS.map((area) => ({ value: area, label: AREA_LABEL[area] }))]}
              tasks={tasks.map((task) => ({
                id: task.id,
                title: task.title,
                stage: task.stage,
                project: [task.area ? AREA_LABEL[task.area] : null, task.market].filter(Boolean).join(" · "),
                due: task.dueDate ? formatDay(task.dueDate) : undefined,
                dueSoon: Boolean(task.dueDate) && Date.parse(`${task.dueDate}T23:59:59Z`) - now < 2 * DAY_MS,
                filterKey: task.area ?? "",
                footer: task.priority ? <Badge size="sm" tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge> : undefined,
              }))}
            />
          ),
        },
        {
          value: "tabla",
          label: "Tabla",
          count: tasks.length,
          content: (
            <SortableDataTable
              rows={rows}
              columns={TABLE_COLUMNS}
              rowKey="id"
              caption="Solicitudes del equipo"
              emptyMessage="Sin solicitudes"
              itemName={{ one: "solicitud", other: "solicitudes" }}
              defaultSort={{ key: "stageOrder", direction: "asc" }}
            />
          ),
        },
        {
          value: "actividad",
          label: "Actividad",
          count: activity.length,
          content: activity.length === 0 ? (
            <EmptyState title="Sin movimientos recientes" description="Los cambios de estado de los últimos 30 días aparecen aquí." />
          ) : (
            <Timeline
              label="Cambios de estado"
              now={now}
              locale="es-MX"
              timeZone={TEAM_TIME_ZONE}
              scrollToNew={false}
              events={activity.map((event) => ({
                id: event.id,
                at: event.at,
                title: event.taskTitle,
                meta: `Pasó a ${STAGE_LABEL[event.stage]}`,
                tone: event.stage === "hecha" ? "success" : "neutral",
              }))}
            />
          ),
        },
      ]}
    />
  );
}
