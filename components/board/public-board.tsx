"use client";

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { ProjectBoard } from "@/components/arc/blocks/project-board/project-board";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { MetricCard } from "@/components/arc/metric-card/metric-card";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { SortableDataTable, type DataColumn } from "@/components/arc/sortable-data-table/sortable-data-table";
import { Timeline } from "@/components/arc/timeline/timeline";
import { AREA_LABEL, AREAS, PRIORITY_LABEL, STAGE_LABEL, STAGES, type Priority } from "@/lib/board-config";
import { formatDay, TEAM_TIME_ZONE } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { boardMetrics } from "@/lib/board-metrics";
import styles from "./public-board.module.css";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { normal: "neutral", media: "info", alta: "warning", critica: "danger" };
const VIEWS = [
  { value: "tablero", label: "Tablero" },
  { value: "tabla", label: "Tabla" },
  { value: "actividad", label: "Actividad" },
];
const DAY_MS = 24 * 60 * 60 * 1000;

interface PublicBoardProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  /** Server time of the snapshot, so the first render matches on server and client. */
  now: number;
}

type Row = {
  id: string;
  title: string;
  area: string;
  stage: string;
  stageOrder: number;
  priority: Priority | null;
  dueDate: string;
};

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

export function PublicBoard({ tasks, activity, now }: PublicBoardProps) {
  const [view, setView] = useState(VIEWS[0].value);
  const metrics = boardMetrics(tasks);

  if (tasks.length === 0) {
    return <EmptyState title="Sin solicitudes" description="Cuando el equipo reciba la primera solicitud aparecerá aquí." />;
  }

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
    <div className={styles.board}>
      <div className={styles.metrics}>
        <MetricCard label="En curso" value={metrics.inProgress} context="solicitudes trabajándose ahora" />
        <MetricCard label="En cola" value={metrics.queued} context="nuevas y listas para arrancar" />
        <MetricCard label="Hechas" value={metrics.done} context="en los últimos 30 días" />
        <MetricCard label="Entrega estimada" value={metrics.averageSla} suffix={"\u00a0días"} context="promedio de lo abierto" />
      </div>

      <SegmentedControl className={styles.views} label="Vista" options={VIEWS} value={view} onValueChange={setView} />

      {view === "tablero" && (
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
      )}

      {view === "tabla" && (
        <div className={styles.tableCard}>
          <SortableDataTable
            rows={rows}
            columns={TABLE_COLUMNS}
            rowKey="id"
            caption="Solicitudes del equipo"
            emptyMessage="Sin solicitudes"
            itemName={{ one: "solicitud", other: "solicitudes" }}
            defaultSort={{ key: "stageOrder", direction: "asc" }}
          />
        </div>
      )}

      {view === "actividad" &&
        (activity.length === 0 ? (
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
        ))}
    </div>
  );
}
