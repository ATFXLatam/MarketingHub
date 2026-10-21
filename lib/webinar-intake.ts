import { columnChangeOn, type DateRange } from "./campaign-intake";
import { addBusinessDays } from "./estimate";

/**
 * Webinars run one monday Project board each, copied from the webinar template. Thomas adds the webinar to the
 * calendar board and moves it to Aprobado; that is the only trigger, so a draft never leaves an empty board behind.
 */
export const WEBINAR_INTAKE = {
  boardId: 18436428026,
  status: "estado",
  approvedLabel: "Aprobado",
  /** The date asked for. */
  date: "fecha_webinar",
  /** The date the board was planned with; written last, so once set the webinar is finished. */
  confirmedDate: "fecha_confirmada",
  time: "horario",
  /** Link to the webinar's board; once set, the webinar already has its board. */
  board: "board_webinar",
} as const;

export const WEBINAR_TEMPLATE = {
  boardId: 18436427253,
  workspaceId: 28457,
  folderId: 21623535,
  timeline: "project_timeline",
  /** Business days from the webinar to the step's first and last day (negative before it). */
  startOffset: "numeric_mm8bzh35",
  endOffset: "numeric_mm8bcnb6",
} as const;

export const webinarStatusChange = (body: unknown): number | null => columnChangeOn(body, WEBINAR_INTAKE.boardId, WEBINAR_INTAKE.status);

const MAX_BOARD_NAME = 100;

export function webinarBoardName(title: string): string {
  const name = `Webinar · ${title.trim().replace(/\s+/g, " ")}`;
  return name.length > MAX_BOARD_NAME ? `${name.slice(0, MAX_BOARD_NAME - 1)}…` : name;
}

export interface OffsetStep {
  id: string;
  start: number | null;
  end: number | null;
}

export interface WebinarPlan {
  webinar: string;
  moved: boolean;
  steps: { id: string; range: DateRange }[];
}

const isWeekend = (isoDate: string) => [0, 6].includes(new Date(`${isoDate}T00:00:00Z`).getUTCDay());

/**
 * Dates every step against the webinar. The team never gets less than the full lead time: when the asked date leaves
 * too few business days before it, the webinar moves to the first date that keeps every step on or after today.
 */
export function planWebinar(steps: OffsetStep[], requested: string, today: string): WebinarPlan {
  const dated = steps.flatMap((step) => (step.start === null ? [] : [{ id: step.id, start: step.start, end: step.end ?? step.start }]));
  const lead = Math.max(0, -Math.min(0, ...dated.map((step) => step.start)));
  const firstDay = isWeekend(today) ? addBusinessDays(today, 1) : today;
  const earliest = addBusinessDays(firstDay, lead);
  const webinar = requested < earliest ? earliest : requested;
  return {
    webinar,
    moved: webinar !== requested,
    steps: dated.map(({ id, start, end }) => ({ id, range: { from: addBusinessDays(webinar, start), to: addBusinessDays(webinar, Math.max(start, end)) } })),
  };
}
