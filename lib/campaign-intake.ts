import { z } from "zod";
import { addBusinessDays } from "./estimate";

/**
 * Affiliate campaigns run one monday Project board each, copied from the MVP board. A request on "Solicitudes
 * Afiliados" (filled by the Affiliate Assets Request form) gets its board when Marketing moves it to Accepted, so a
 * test or rejected submission never leaves an empty project behind.
 */
export const AFFILIATE_INTAKE = {
  boardId: 18435346759,
  status: "color_mm8377y2",
  acceptedLabel: "Accepted",
  /** Link to the campaign board; once set, the request already has its board. */
  campaignLink: "link_mm83jm5c",
  affiliate: "short_textgfbi2aja",
  product: "single_selectzaf122s",
  launch: "dateppkl5rzt",
} as const;

export const CAMPAIGN_TEMPLATE = {
  boardId: 18435159518,
  workspaceId: 28457,
  folderId: 21623535,
  /** One-off setup tasks that belong to the program, not to each campaign. */
  setupGroup: "group_mm82qtfr",
  requestGroup: "group_mm82f0jq",
  timeline: "project_timeline",
} as const;

export const CAMPAIGN_PORTFOLIO = {
  boardId: 18435249679,
  scope: "portfolio_project_scope",
  plannedTimeline: "portfolio_project_planned_timeline",
} as const;

const EventSchema = z.object({
  event: z.object({
    boardId: z.coerce.number().int().positive(),
    pulseId: z.coerce.number().int().positive(),
    columnId: z.string(),
  }),
});

/** The item whose column changed on that board. The value itself is re-read from the API: the payload is unsigned. */
export function columnChangeOn(body: unknown, board: number, column: string): number | null {
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return null;
  const { boardId, pulseId, columnId } = parsed.data.event;
  return boardId === board && columnId === column ? pulseId : null;
}

/** The affiliate request whose status changed. */
export const intakeStatusChange = (body: unknown): number | null => columnChangeOn(body, AFFILIATE_INTAKE.boardId, AFFILIATE_INTAKE.status);

// monday caps board names; the request title is free text from the form.
const MAX_BOARD_NAME = 100;

export function campaignBoardName(requestTitle: string): string {
  const name = `Campaign · ${requestTitle.trim().replace(/\s+/g, " ")}`;
  return name.length > MAX_BOARD_NAME ? `${name.slice(0, MAX_BOARD_NAME - 1)}…` : name;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  from: string;
  to: string;
}

/** "2026-10-13 - 2026-10-14" as monday renders a timeline, or null when the cell is empty. */
export function parseRange(text: string | null | undefined): DateRange | null {
  const dates = text?.match(/\d{4}-\d{2}-\d{2}/g);
  if (!dates?.length) return null;
  return { from: dates[0], to: dates[dates.length - 1] };
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

/**
 * The template's dates are a worked example starting on its first task. Each of its days counts as one business day
 * of the copy, so a step that crosses a weekend grows by the weekend instead of having it eaten from its deadline. The
 * copy starts on `start`, or the next Monday when that is a weekend; tasks without dates stay empty.
 */
export function shiftTimelines<T extends { id: string; range: DateRange | null }>(tasks: T[], start: string): { id: string; range: DateRange }[] {
  if (!ISO_DATE.test(start)) throw new Error(`start must be YYYY-MM-DD, got ${start}`);
  const dated = tasks.flatMap((task) => (task.range ? [{ id: task.id, range: task.range }] : []));
  if (!dated.length) return [];
  const anchor = dated.reduce((min, task) => (task.range.from < min ? task.range.from : min), dated[0].range.from);
  const first = isWeekend(start) ? addBusinessDays(start, 1) : start;
  const at = (date: string) => addBusinessDays(first, daysBetween(anchor, date));
  return dated.map(({ id, range }) => ({ id, range: { from: at(range.from), to: at(range.to) } }));
}

export function spanOf(ranges: DateRange[]): DateRange | null {
  if (!ranges.length) return null;
  return {
    from: ranges.reduce((min, range) => (range.from < min ? range.from : min), ranges[0].from),
    to: ranges.reduce((max, range) => (range.to > max ? range.to : max), ranges[0].to),
  };
}

/** The board id in the request's Campaign board link ("Campaign · X - https://atfx.monday.com/boards/123"). */
export function boardIdFromLink(text: string | null | undefined): string | null {
  return text?.match(/\/boards\/(\d+)/)?.[1] ?? null;
}
