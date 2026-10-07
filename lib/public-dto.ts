import { z } from "zod";
import {
  AREA_LABEL_ID,
  COLUMNS,
  PRIORITY_LABEL_ID,
  STAGE_MONDAY_TEXT,
  STAGE_LABEL_ID,
  type Area,
  type Priority,
  type Stage,
} from "./board-config";

/**
 * The only shape that ever reaches the public board. Requester name and email, brief, blockers, Drive and attachments
 * never leave the server: they are not read from monday in the first place, and this mapper builds the object field by
 * field instead of spreading the item.
 */
export interface PublicOwner {
  id: string;
  name: string;
  photo: string | null;
  /** Job title from the monday profile, such as "Web Developer". */
  title: string | null;
  /** IANA zone from the monday profile, for the member's local time. */
  timeZone: string | null;
}

export interface PublicTask {
  id: string;
  title: string;
  /** The team members responsible: names and photos only, never their emails. */
  owners: PublicOwner[];
  area: Area | null;
  stage: Stage;
  priority: Priority | null;
  dueDate: string | null;
  slaDays: number | null;
  market: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicEvent {
  id: string;
  taskId: string;
  taskTitle: string;
  stage: Stage;
  at: string;
}

/** Columns the public board reads. Keeping the request narrow is the first layer of the whitelist. */
export const PUBLIC_COLUMN_IDS = [
  COLUMNS.status,
  COLUMNS.area,
  COLUMNS.priority,
  COLUMNS.dueDate,
  COLUMNS.slaDays,
  COLUMNS.market,
  COLUMNS.owner,
] as const;

const ColumnValueSchema = z.object({
  id: z.string(),
  text: z.string().nullable(),
  index: z.number().nullable().optional(),
  persons_and_teams: z
    .array(z.object({ id: z.union([z.string(), z.number()]), kind: z.string() }))
    .nullable()
    .optional(),
});

export const RawItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  column_values: z.array(ColumnValueSchema),
});
export type RawItem = z.infer<typeof RawItemSchema>;

function byLabelId<K extends string>(ids: Record<K, number>, labelId: number | null | undefined): K | null {
  if (labelId === null || labelId === undefined) return null;
  const entry = (Object.entries(ids) as [K, number][]).find(([, id]) => id === labelId);
  return entry ? entry[0] : null;
}

function stageFrom(labelId: number | null | undefined, text: string | null): Stage {
  const byId = byLabelId(STAGE_LABEL_ID, labelId);
  if (byId) return byId;
  const byText = (Object.entries(STAGE_MONDAY_TEXT) as [Stage, string][]).find(
    ([, label]) => label.toLowerCase() === text?.trim().toLowerCase(),
  );
  // An unlabeled status in monday means nobody triaged it yet.
  return byText ? byText[0] : "nueva";
}

const nonEmpty = (value: string | null | undefined) => (value && value.trim() ? value.trim() : null);

const PHOTO_HOST = "files.monday.com";

/** Only uploaded photos on monday's file CDN, the host next.config allows; default avatars live elsewhere and fall back to initials. */
export function ownerPhoto(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === PHOTO_HOST && url.pathname.includes("/photos/") ? url.href : null;
  } catch {
    return null;
  }
}

/** Person ids assigned on any item, so the board can look their names and photos up in one request. */
export function ownerIds(items: RawItem[]): string[] {
  const ids = items.flatMap((item) =>
    item.column_values
      .filter((value) => value.id === COLUMNS.owner)
      .flatMap((value) => value.persons_and_teams ?? [])
      .filter((entry) => entry.kind === "person")
      .map((entry) => String(entry.id)),
  );
  return [...new Set(ids)];
}

export function toPublicTask(item: RawItem, people: ReadonlyMap<string, PublicOwner> = new Map()): PublicTask {
  const column = (id: string) => item.column_values.find((value) => value.id === id);
  const owners = (column(COLUMNS.owner)?.persons_and_teams ?? [])
    .filter((entry) => entry.kind === "person")
    .map((entry) => people.get(String(entry.id)))
    .filter((owner): owner is PublicOwner => owner !== undefined);
  const status = column(COLUMNS.status);
  const sla = Number(nonEmpty(column(COLUMNS.slaDays)?.text));
  return {
    id: item.id,
    title: item.name,
    owners,
    area: byLabelId(AREA_LABEL_ID, column(COLUMNS.area)?.index),
    stage: stageFrom(status?.index, status?.text ?? null),
    priority: byLabelId(PRIORITY_LABEL_ID, column(COLUMNS.priority)?.index),
    dueDate: nonEmpty(column(COLUMNS.dueDate)?.text),
    slaDays: Number.isFinite(sla) && sla > 0 ? sla : null,
    market: nonEmpty(column(COLUMNS.market)?.text),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

const DONE_WINDOW_DAYS = 30;

/** Finished work stays on the board for a month, so the board shows the current flow and not the whole archive. */
export function visibleTasks(tasks: PublicTask[], now: number): PublicTask[] {
  const cutoff = now - DONE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return tasks.filter((task) => task.stage !== "hecha" || Date.parse(task.updatedAt) >= cutoff);
}

const ActivityDataSchema = z.object({
  pulse_id: z.union([z.number(), z.string()]),
  pulse_name: z.string(),
  column_id: z.string(),
  value: z.object({ label: z.object({ index: z.number().optional(), text: z.string().optional() }) }).nullable(),
});

export const RawActivitySchema = z.object({
  id: z.string(),
  event: z.string(),
  data: z.string(),
  created_at: z.string(),
});
export type RawActivity = z.infer<typeof RawActivitySchema>;

/** monday stamps activity logs in 100-nanosecond units since the epoch. */
const activityTime = (value: string) => new Date(Number(value) / 10_000).toISOString();

/** Status changes only, and only the title and the new stage: the log also carries user ids and previous values. */
export function toPublicEvent(log: RawActivity): PublicEvent | null {
  if (log.event !== "update_column_value") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(log.data);
  } catch {
    return null;
  }
  const parsed = ActivityDataSchema.safeParse(raw);
  if (!parsed.success || parsed.data.column_id !== COLUMNS.status || !parsed.data.value) return null;
  const label = parsed.data.value.label;
  return {
    id: log.id,
    taskId: String(parsed.data.pulse_id),
    taskTitle: parsed.data.pulse_name,
    stage: stageFrom(label.index, label.text ?? null),
    at: activityTime(log.created_at),
  };
}
