"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";
import { ProjectBoard } from "@/components/arc/blocks/project-board/project-board";
import { ChipGroup } from "@/components/arc/chip-group/chip-group";
import { DataGrid } from "@/components/arc/data-grid/data-grid";
import type { DataGridColumn, DataGridRow } from "@/components/arc/data-grid/data-grid-model";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { AREA_LABEL, AREAS, PRIORITIES, PRIORITY_LABEL, STAGE_LABEL, STAGES, type Priority } from "@/lib/board-config";
import { formatDay } from "@/lib/dates";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { daysUntil } from "@/lib/team";
import { TaskDrawer } from "./task-drawer";
import { PERSON_PARAM, setUrlParam, useUrlParam } from "./url-state";
import styles from "./team-board.module.css";

const PRIORITY_TONE: Record<Priority, BadgeTone> = { normal: "neutral", media: "info", alta: "warning", critica: "danger" };
const TASK_PARAM = "task";
const PHONE_QUERY = "(max-width: 700px)";

// Status is edited in monday, so no column is editable here.
const COLUMNS: DataGridColumn[] = [
  { key: "title", label: "Request", width: 300, editable: false },
  { key: "stage", label: "Status", type: "select", options: STAGES.map((stage) => STAGE_LABEL[stage]), width: 130, editable: false },
  { key: "area", label: "Area", type: "select", options: AREAS.map((area) => AREA_LABEL[area]), width: 120, editable: false },
  { key: "priority", label: "Priority", type: "select", options: PRIORITIES.map((priority) => PRIORITY_LABEL[priority]), width: 120, editable: false },
  { key: "owners", label: "Owners", width: 220, editable: false },
  { key: "market", label: "Market", type: "select", width: 150, editable: false },
  // ISO dates sort and filter as text in calendar order.
  { key: "dueDate", label: "Due date", width: 150, editable: false },
  { key: "slaDays", label: "Estimated days", type: "number", aggregate: "average", decimals: 0, width: 140, editable: false },
];

function subscribeToPhone(onChange: () => void) {
  const query = matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The URL holds the open request, so ?task=<id> links straight to its details.
const select = (id: string | null) => setUrlParam(TASK_PARAM, id);

export interface TeamBoardProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  now: number;
  today: string;
}

export function TeamBoard({ tasks, activity, now, today }: TeamBoardProps) {
  // Until someone picks a view, it follows the screen: kanban on desktop, table on a phone.
  const [picked, setPicked] = useState<string | null>(null);
  const isPhone = useSyncExternalStore(subscribeToPhone, () => matchMedia(PHONE_QUERY).matches, () => false);
  const view = picked ?? (isPhone ? "table" : "board");
  const [areas, setAreas] = useState<string[]>([]);
  const selectedId = useUrlParam(TASK_PARAM);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const personId = useUrlParam(PERSON_PARAM);
  const person = tasks.flatMap((task) => task.owners).find((owner) => owner.id === personId);

  const areaOptions = useMemo(
    () => AREAS.map((area) => ({ value: area, label: `${AREA_LABEL[area]} · ${tasks.filter((task) => task.area === area).length}` })),
    [tasks],
  );
  const shown = useMemo(
    () =>
      tasks.filter(
        (task) => (!areas.length || (task.area && areas.includes(task.area))) && (!person || task.owners.some((owner) => owner.id === person.id)),
      ),
    [tasks, areas, person],
  );
  const team = [...new Map(shown.flatMap((task) => task.owners).map((owner) => [owner.id, { name: owner.name, src: owner.photo ?? undefined }])).values()];
  const rows: DataGridRow[] = shown.map((task) => ({
    id: task.id,
    title: task.title,
    stage: STAGE_LABEL[task.stage],
    area: task.area ? AREA_LABEL[task.area] : null,
    priority: task.priority ? PRIORITY_LABEL[task.priority] : null,
    owners: task.owners.map((owner) => owner.name).join(", ") || null,
    market: task.market,
    dueDate: task.dueDate,
    slaDays: task.slaDays,
  }));

  return (
    <section className={styles.root} aria-labelledby="board-title">
      <div className={styles.head}>
        <h2 id="board-title" className={styles.heading}>Requests</h2>
        <div className={styles.toolbar}>
          {person && (
            <Button variant="secondary" size="sm" onClick={() => setUrlParam(PERSON_PARAM, null)} aria-label={`Clear filter: ${person.name}`}>
              <Avatar name={person.name} src={person.photo ?? undefined} size="sm" />
              {person.name.split(" ")[0]}
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </Button>
          )}
          <ChipGroup label="Filter by area" options={areaOptions} value={areas} onValueChange={setAreas} multiple />
          <SegmentedControl
            label="View"
            value={view}
            onValueChange={setPicked}
            options={[
              { value: "board", label: "Board" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
      </div>
      {view === "board" ? (
        <ProjectBoard
          title="Team flow"
          team={team}
          doneStage="hecha"
          stages={STAGES.map((stage) => ({ id: stage, label: STAGE_LABEL[stage] }))}
          onSelect={select}
          tasks={shown.map((task) => ({
            id: task.id,
            title: task.title,
            stage: task.stage,
            owners: task.owners.map((owner) => ({ name: owner.name, src: owner.photo ?? undefined })),
            project: [task.area ? AREA_LABEL[task.area] : null, task.market].filter(Boolean).join(" · "),
            due: task.dueDate ? formatDay(task.dueDate) : undefined,
            dueSoon: Boolean(task.dueDate) && daysUntil(task.dueDate!, today) <= 2,
            filterKey: task.area ?? "",
            footer: task.priority ? <Badge size="sm" tone={PRIORITY_TONE[task.priority]}>{PRIORITY_LABEL[task.priority]}</Badge> : undefined,
          }))}
        />
      ) : (
        <DataGrid
          label="Team requests"
          exportFileName="marketing-latam-requests"
          columns={COLUMNS}
          rows={rows}
          defaultSort={[{ key: "dueDate", dir: "asc" }]}
          rowSelection={false}
          canDeleteRows={false}
          maxHeight={640}
          emptyMessage="No requests"
        />
      )}
      <TaskDrawer task={selected} history={activity} now={now} today={today} onClose={() => select(null)} />
    </section>
  );
}
