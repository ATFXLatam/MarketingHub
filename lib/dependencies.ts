import { z } from "zod";

// The ids every monday Project board is created with, so one webhook serves Webinars, Affiliates and the next ones.
export const STATUS_COLUMN = "project_status";
export const DEPENDENCY_COLUMN = "project_dependency";
export const BLOCKED_LABEL = "Bloqueada";
export const READY_LABEL = "Lista para empezar";

export interface Task {
  id: string;
  /** Status label id, or null when the cell is empty. */
  status: number | null;
  dependsOn: string[];
  /** A parent row on a multi-level board shows a rollup of its children and cannot be written. */
  leaf: boolean;
}

export interface StatusLabel {
  id: number;
  label: string;
  done: boolean;
}

/** Only the ids are read from monday's payload: a personal-token webhook is unsigned, so the state comes from the API. */
const EventSchema = z.object({
  event: z.object({
    boardId: z.coerce.number().int().positive(),
    pulseId: z.coerce.number().int().positive(),
    columnId: z.string(),
  }),
});

export function statusChange(body: unknown): { boardId: number; itemId: number } | null {
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success || parsed.data.event.columnId !== STATUS_COLUMN) return null;
  return { boardId: parsed.data.event.boardId, itemId: parsed.data.event.pulseId };
}

/**
 * Tasks that finishing `doneId` releases: they wait on it, are still Bloqueada, and every other task they wait on is
 * done too. Anything a person already moved (Working on it, Stuck) is left alone.
 */
export function unblockedBy(doneId: string, tasks: Task[], labels: StatusLabel[]): string[] {
  const doneIds = new Set(labels.filter((label) => label.done).map((label) => label.id));
  const blocked = labels.find((label) => label.label === BLOCKED_LABEL)?.id;
  if (blocked === undefined) return [];

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const isDone = (id: string) => {
    const status = byId.get(id)?.status;
    return status != null && doneIds.has(status);
  };
  if (!isDone(doneId)) return [];

  return tasks
    .filter((task) => task.leaf && task.status === blocked && task.dependsOn.includes(doneId))
    .filter((task) => task.dependsOn.every(isDone))
    .map((task) => task.id);
}
