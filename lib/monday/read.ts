import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { BOARD_ID } from "../board-config";
import {
  ownerIds,
  PUBLIC_COLUMN_IDS,
  RawActivitySchema,
  RawItemSchema,
  toPublicEvent,
  toPublicTask,
  visibleTasks,
  type PublicEvent,
  type PublicOwner,
  type PublicTask,
} from "../public-dto";
import { mondayConfigured, mondayQuery } from "./client";

export const BOARD_TAG = `monday:board:${BOARD_ID}`;

const PAGE_SIZE = 500;
const ACTIVITY_DAYS = 30;
const ACTIVITY_LIMIT = 60;

const ITEM_FIELDS = `id name created_at updated_at column_values(ids: $columns) { id text ... on StatusValue { index } ... on PeopleValue { persons_and_teams { id kind } } }`;

const FirstPageSchema = z.object({
  boards: z.array(
    z.object({
      items_page: z.object({ cursor: z.string().nullable(), items: z.array(RawItemSchema) }),
      activity_logs: z.array(RawActivitySchema).nullable(),
    }),
  ),
});
const NextPageSchema = z.object({
  next_items_page: z.object({ cursor: z.string().nullable(), items: z.array(RawItemSchema) }),
});

const UsersSchema = z.object({
  users: z.array(z.object({ id: z.union([z.string(), z.number()]), name: z.string(), photo_thumb_small: z.string().nullable() })).nullable(),
});

/** Names and photos of the assigned people; their emails are never requested. */
async function fetchOwners(ids: string[]): Promise<Map<string, PublicOwner>> {
  if (ids.length === 0) return new Map();
  const { users } = UsersSchema.parse(
    await mondayQuery(`query ($ids: [ID!]) { users(ids: $ids) { id name photo_thumb_small } }`, { ids }),
  );
  return new Map(
    (users ?? []).map((user) => [String(user.id), { id: String(user.id), name: user.name, photo: user.photo_thumb_small }]),
  );
}

export interface BoardSnapshot {
  configured: boolean;
  tasks: PublicTask[];
  activity: PublicEvent[];
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
  if (!mondayConfigured()) return { configured: false, tasks: [], activity: [], fetchedAt: new Date(now).toISOString() };

  const from = new Date(now - ACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const first = FirstPageSchema.parse(
    await mondayQuery(
      `query ($board: [ID!], $columns: [String!], $from: ISO8601DateTime, $statusColumn: [String]) {
        boards(ids: $board) {
          items_page(limit: ${PAGE_SIZE}) { cursor items { ${ITEM_FIELDS} } }
          activity_logs(from: $from, column_ids: $statusColumn, limit: ${ACTIVITY_LIMIT}) { id event data created_at }
        }
      }`,
      { board: [BOARD_ID], columns: [...PUBLIC_COLUMN_IDS], from, statusColumn: [PUBLIC_COLUMN_IDS[0]] },
    ),
  );
  const board = first.boards[0];
  if (!board) throw new Error(`El tablero ${BOARD_ID} no existe o el token no tiene acceso`);

  let items = board.items_page.items;
  let cursor = board.items_page.cursor;
  while (cursor) {
    const next = NextPageSchema.parse(
      await mondayQuery(
        `query ($cursor: String!, $columns: [String!]) {
          next_items_page(cursor: $cursor, limit: ${PAGE_SIZE}) { cursor items { ${ITEM_FIELDS} } }
        }`,
        { cursor, columns: [...PUBLIC_COLUMN_IDS] },
      ),
    );
    items = [...items, ...next.next_items_page.items];
    cursor = next.next_items_page.cursor;
  }

  const people = await fetchOwners(ownerIds(items));
  return {
    configured: true,
    tasks: visibleTasks(
      items.map((item) => toPublicTask(item, people)),
      now,
    ),
    activity: (board.activity_logs ?? []).map(toPublicEvent).filter((event): event is PublicEvent => event !== null),
    fetchedAt: new Date(now).toISOString(),
  };
}
