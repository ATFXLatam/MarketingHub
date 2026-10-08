import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { BOARD_ID, CAMPAIGNS_BOARD, DEFAULT_AVATAR, SOURCE_BOARDS, TEAM_ROSTER, type SourceBoard } from "../board-config";
import {
  ownerIds,
  ownerPhoto,
  PUBLIC_COLUMN_IDS,
  RawActivitySchema,
  RawItemSchema,
  toPublicEvent,
  toPublicTask,
  visibleTasks,
  type PublicCampaign,
  type PublicEvent,
  type PublicOwner,
  type PublicTask,
  type RawItem,
} from "../public-dto";
import { teamMembers, type TeamMember } from "../team";
import { CAMPAIGN_COLUMN_IDS, isCurrent, sourceOwnerIds, toPublicCampaign, toSourceEvent, toSourceTask } from "../sources";
import { mondayConfigured, mondayQuery } from "./client";

export const BOARD_TAG = `monday:board:${BOARD_ID}`;

const PAGE_SIZE = 500;
const ACTIVITY_DAYS = 60;
const ACTIVITY_LIMIT = 300;

const ITEM_FIELDS = `id name group { id } created_at updated_at column_values(ids: $columns) { id text ... on StatusValue { index } ... on PeopleValue { persons_and_teams { id kind } } }`;

const NextPageSchema = z.object({
  next_items_page: z.object({ cursor: z.string().nullable(), items: z.array(RawItemSchema) }),
});

const UsersSchema = z.object({
  users: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]),
        name: z.string(),
        title: z.string().nullable(),
        time_zone_identifier: z.string().nullable(),
        photo_thumb_small: z.string().nullable(),
      }),
    )
    .nullable(),
});

/** Names and photos of the assigned people; their emails are never requested. */
async function fetchOwners(ids: string[]): Promise<Map<string, PublicOwner>> {
  if (ids.length === 0) return new Map();
  const { users } = UsersSchema.parse(
    await mondayQuery(`query ($ids: [ID!]) { users(ids: $ids) { id name title time_zone_identifier photo_thumb_small } }`, { ids }),
  );
  return new Map(
    (users ?? []).map((user) => [String(user.id), { id: String(user.id), name: user.name, photo: ownerPhoto(user.photo_thumb_small) ?? DEFAULT_AVATAR, title: user.title?.trim() || null, timeZone: user.time_zone_identifier }]),
  );
}

const BoardPageSchema = z.object({
  boards: z.array(
    z.object({
      items_page: z.object({ cursor: z.string().nullable(), items: z.array(RawItemSchema) }),
      activity_logs: z.array(RawActivitySchema).nullable().optional(),
    }),
  ),
});

/** Every item of one board, plus status changes since `from` when a status column is given. */
async function readBoard(boardId: number, columns: string[], from: string, statusColumn?: string): Promise<{ items: RawItem[]; activity: z.infer<typeof RawActivitySchema>[] }> {
  const logs = statusColumn ? `activity_logs(from: $from, column_ids: $statusColumn, limit: ${ACTIVITY_LIMIT}) { id event data created_at }` : "";
  const first = BoardPageSchema.parse(
    await mondayQuery(
      // monday rejects declared variables a query never uses, so the log variables come with the log field.
      `query ($board: [ID!], $columns: [String!]${statusColumn ? ", $from: ISO8601DateTime, $statusColumn: [String]" : ""}) {
        boards(ids: $board) { items_page(limit: ${PAGE_SIZE}) { cursor items { ${ITEM_FIELDS} } } ${logs} }
      }`,
      statusColumn ? { board: [boardId], columns, from, statusColumn: [statusColumn] } : { board: [boardId], columns },
    ),
  ).boards[0];
  if (!first) throw new Error(`Board ${boardId} does not exist or the token has no access to it`);
  let items = first.items_page.items;
  let cursor = first.items_page.cursor;
  while (cursor) {
    const next = NextPageSchema.parse(
      await mondayQuery(
        `query ($cursor: String!, $columns: [String!]) { next_items_page(cursor: $cursor, limit: ${PAGE_SIZE}) { cursor items { ${ITEM_FIELDS} } } }`,
        { cursor, columns },
      ),
    );
    items = [...items, ...next.next_items_page.items];
    cursor = next.next_items_page.cursor;
  }
  return { items, activity: first.activity_logs ?? [] };
}

const sourceColumns = (board: SourceBoard) => [board.status, board.owner, board.due, ...(board.role ? [board.role] : [])];

export interface BoardSnapshot {
  configured: boolean;
  tasks: PublicTask[];
  activity: PublicEvent[];
  /** Team members from TEAM_ROSTER, listed even before they have work assigned. */
  roster: PublicOwner[];
  /** The one team list every widget, filter and the AI read: roster plus everyone assigned on any board, busiest first. */
  members: TeamMember[];
  campaigns: PublicCampaign[];
  fetchedAt: string;
}

/**
 * One cached read per board change, not per visit: the webhook revalidates BOARD_TAG, and the hourly lifetime covers a
 * webhook that monday stopped retrying after its 30 minute window.
 */
export async function getBoardSnapshot(): Promise<BoardSnapshot> {
  "use cache";
  cacheTag(BOARD_TAG);
  cacheLife("hours");

  const now = Date.now();
  if (!mondayConfigured()) return { configured: false, tasks: [], activity: [], roster: [], members: [], campaigns: [], fetchedAt: new Date(now).toISOString() };

  const from = new Date(now - ACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // One read per board, all at once; the snapshot is still a single cache entry every widget shares.
  const [requests, sources, campaigns] = await Promise.all([
    readBoard(BOARD_ID, [...PUBLIC_COLUMN_IDS], from, PUBLIC_COLUMN_IDS[0]),
    Promise.all(SOURCE_BOARDS.map((board) => readBoard(board.id, sourceColumns(board), from, board.status))),
    readBoard(CAMPAIGNS_BOARD.id, CAMPAIGN_COLUMN_IDS, from),
  ]);

  const people = await fetchOwners([
    ...new Set([...ownerIds(requests.items), ...SOURCE_BOARDS.flatMap((board, index) => sourceOwnerIds(board, sources[index].items)), ...TEAM_ROSTER]),
  ]);
  const sourceTasks = SOURCE_BOARDS.flatMap((board, index) =>
    sources[index].items.flatMap((item) => toSourceTask(board, item, people) ?? []).filter((task) => isCurrent(task, now)),
  );
  const sourceEvents = SOURCE_BOARDS.flatMap((board, index) => sources[index].activity.flatMap((log) => toSourceEvent(board, log) ?? []));
  const tasks = visibleTasks([...requests.items.map((item) => toPublicTask(item, people)), ...sourceTasks], now);
  const roster = TEAM_ROSTER.flatMap((id) => people.get(id) ?? []);
  return {
    configured: true,
    tasks,
    roster,
    members: teamMembers(tasks, roster),
    activity: [...requests.activity.flatMap((log) => toPublicEvent(log) ?? []), ...sourceEvents].sort((a, b) => b.at.localeCompare(a.at)),
    campaigns: campaigns.items.map(toPublicCampaign),
    fetchedAt: new Date(now).toISOString(),
  };
}

/** Names and photos of configured area owners, cached like the board so opening the request flow costs no monday call. */
export async function getAreaPeople(ids: string[]): Promise<Map<string, PublicOwner>> {
  "use cache";
  cacheTag(BOARD_TAG);
  cacheLife("hours");
  if (!mondayConfigured() || ids.length === 0) return new Map();
  return fetchOwners([...new Set(ids)].sort());
}
