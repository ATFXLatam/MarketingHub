import { columnChangeOn, type DateRange } from "./campaign-intake";
import { addBusinessDays } from "./estimate";
import type { OffsetStep } from "./webinar-intake";

/**
 * Retail lead-generation campaigns run one monday Project board each, copied from the retail template. A request on
 * "Campañas Retail · Solicitudes" (filled by its form) gets its board when Thomas or Ergin move it to Aprobado; the
 * decision stays with them, without the Hong Kong approval the affiliate flow needs.
 */
export const RETAIL_INTAKE = {
  boardId: 18438455375,
  formToken: "2a729bc45e7187b413600cee970f3531",
  status: "estado",
  approvedLabel: "Aprobado",
  team: "single_selectq2bj77v",
  launch: "date4k8y8mkv",
  /** Link to the campaign's board; once set, the request already has its board. */
  board: "board_campana",
  /** The day the board was planned from; written last, so once set the request is finished. */
  startDate: "fecha_inicio",
} as const;

export const RETAIL_TEMPLATE = {
  boardId: 18438454965,
  workspaceId: 28457,
  folderId: 21623535,
  timeline: "project_timeline",
  /** Business days from the approval to the step's first and last day. */
  startOffset: "numeric_mm8bzh35",
  endOffset: "numeric_mm8bcnb6",
} as const;

export const retailStatusChange = (body: unknown): number | null => columnChangeOn(body, RETAIL_INTAKE.boardId, RETAIL_INTAKE.status);

const MAX_BOARD_NAME = 100;

export function retailBoardName(title: string): string {
  const name = `Campaña Retail · ${title.trim().replace(/\s+/g, " ")}`;
  return name.length > MAX_BOARD_NAME ? `${name.slice(0, MAX_BOARD_NAME - 1)}…` : name;
}

const isWeekend = (isoDate: string) => [0, 6].includes(new Date(`${isoDate}T00:00:00Z`).getUTCDay());

/** Dates every step in business days from the approval day, or from the next Monday when approved on a weekend. */
export function planRetail(steps: OffsetStep[], today: string): { id: string; range: DateRange }[] {
  const first = isWeekend(today) ? addBusinessDays(today, 1) : today;
  return steps.flatMap(({ id, start, end }) =>
    start === null ? [] : [{ id, range: { from: addBusinessDays(first, start), to: addBusinessDays(first, Math.max(start, end ?? start)) } }],
  );
}
