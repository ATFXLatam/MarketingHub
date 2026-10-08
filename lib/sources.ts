import { z } from "zod";
import { CAMPAIGNS_BOARD, SOURCE_STALE_DAYS, type SourceBoard, type Stage } from "./board-config";
import { ActivityDataSchema, activityTime, nonEmpty, type PublicCampaign, type PublicEvent, type PublicOwner, type PublicTask, type RawActivity, type RawItem } from "./public-dto";

const DAY_MS = 24 * 60 * 60 * 1000;

const column = (item: RawItem, id: string) => item.column_values.find((value) => value.id === id);

/** A label the board maps, or null when the label keeps the item off the hub (Cancelled, Guideline). Unlabeled is new. */
export function sourceStage(board: SourceBoard, labelId: number | null | undefined, text: string | null): Stage | null {
  if (labelId === null || labelId === undefined || !text?.trim()) return "nueva";
  return board.stages[labelId] ?? null;
}

/** A date column reads "2026-10-02"; a timeline reads "2026-09-30 - 2026-10-02" and is due on its end. */
export function dueFrom(text: string | null | undefined): string | null {
  const dates = text?.match(/\d{4}-\d{2}-\d{2}/g);
  return dates ? dates[dates.length - 1] : null;
}

/**
 * Boards that plan by role write a first name ("Diego") before anyone is assigned. It counts as that person only when
 * exactly one known person has that first name, so a guess never lands work on the wrong person.
 */
export function ownerByFirstName(name: string | null, people: ReadonlyMap<string, PublicOwner>): PublicOwner | null {
  const first = name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first) return null;
  const matches = [...people.values()].filter((person) => person.name.split(/\s+/)[0]?.toLowerCase() === first);
  return matches.length === 1 ? matches[0] : null;
}

/** Person ids assigned on another board's items, for the shared people lookup. */
export function sourceOwnerIds(board: SourceBoard, items: RawItem[]): string[] {
  return items.flatMap((item) =>
    (column(item, board.owner)?.persons_and_teams ?? []).filter((entry) => entry.kind === "person").map((entry) => String(entry.id)),
  );
}

export function toSourceTask(board: SourceBoard, item: RawItem, people: ReadonlyMap<string, PublicOwner>): PublicTask | null {
  if (item.group && board.hiddenGroups?.includes(item.group.id)) return null;
  const status = column(item, board.status);
  const stage = sourceStage(board, status?.index, status?.text ?? null);
  if (!stage) return null;
  const assigned = (column(item, board.owner)?.persons_and_teams ?? [])
    .filter((entry) => entry.kind === "person")
    .flatMap((entry) => people.get(String(entry.id)) ?? []);
  const byRole = assigned.length || !board.role ? null : ownerByFirstName(nonEmpty(column(item, board.role)?.text), people);
  return {
    id: item.id,
    title: item.name,
    source: board.source,
    owners: byRole ? [byRole] : assigned,
    area: null,
    stage,
    priority: null,
    dueDate: dueFrom(column(item, board.due)?.text),
    slaDays: null,
    market: null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

/**
 * Years of open items nobody closed sit on these boards; counting them would bury this month's work under a hundred
 * overdue ghosts. Open work stays while it was touched or is due within the window. Done work follows visibleTasks.
 */
export function isCurrent(task: PublicTask, now: number): boolean {
  if (task.stage === "hecha") return true;
  const cutoff = now - SOURCE_STALE_DAYS * DAY_MS;
  return Date.parse(task.updatedAt) >= cutoff || (task.dueDate !== null && Date.parse(`${task.dueDate}T00:00:00Z`) >= cutoff);
}

/** Status changes on another board, mapped through that board's labels; changes to hidden labels are skipped. */
export function toSourceEvent(board: SourceBoard, log: RawActivity): PublicEvent | null {
  if (log.event !== "update_column_value") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(log.data);
  } catch {
    return null;
  }
  const parsed = ActivityDataSchema.safeParse(raw);
  if (!parsed.success || parsed.data.column_id !== board.status || !parsed.data.value) return null;
  const stage = sourceStage(board, parsed.data.value.label.index, parsed.data.value.label.text ?? null);
  if (!stage) return null;
  return { id: log.id, taskId: String(parsed.data.pulse_id), taskTitle: parsed.data.pulse_name, stage, at: activityTime(log.created_at) };
}

export const CAMPAIGN_COLUMN_IDS = Object.values(CAMPAIGNS_BOARD.columns);

export function toPublicCampaign(item: RawItem): PublicCampaign {
  const text = (id: string) => nonEmpty(column(item, id)?.text);
  const { columns } = CAMPAIGNS_BOARD;
  return {
    id: item.id,
    name: item.name,
    status: text(columns.status),
    region: text(columns.region),
    country: text(columns.country),
    channel: text(columns.channel),
    start: text(columns.start),
    end: text(columns.end),
    kpi: text(columns.kpi),
    target: text(columns.target),
    achieved: text(columns.achieved),
  };
}

export const SourceBoardsSchema = z.object({
  boards: z.array(
    z.object({
      id: z.union([z.string(), z.number()]),
      items_page: z.object({ cursor: z.string().nullable(), items: z.array(z.unknown()) }),
      activity_logs: z.array(z.unknown()).nullable(),
    }),
  ),
});

export type CampaignPhase = "Live" | "Planned" | "Ended";

/**
 * monday's status alone reads "Live" for campaigns that ended months ago, since nobody moves it after the end date. The
 * dates decide whether a campaign is over or still ahead; only inside its window does the status say if it launched.
 */
export function campaignPhase(campaign: Pick<PublicCampaign, "status" | "start" | "end">, today: string): CampaignPhase {
  if (campaign.end && campaign.end < today) return "Ended";
  if (campaign.start && campaign.start > today) return "Planned";
  return campaign.status === "Live" ? "Live" : "Planned";
}

const PHASE_ORDER: Record<CampaignPhase, number> = { Live: 0, Planned: 1, Ended: 2 };

/** Running campaigns first, then what is coming, then what ended, each by start date. */
export function byPhase(campaigns: PublicCampaign[], today: string): (PublicCampaign & { phase: CampaignPhase })[] {
  return campaigns
    .map((campaign) => ({ ...campaign, phase: campaignPhase(campaign, today) }))
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || (a.start ?? "9999").localeCompare(b.start ?? "9999"));
}
