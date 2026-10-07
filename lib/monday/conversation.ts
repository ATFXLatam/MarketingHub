import "server-only";
import { z } from "zod";
import { BOARD_ID, COLUMNS } from "../board-config";
import { commentHtml, RawUpdateSchema, toConversation, type Conversation } from "../conversation";
import { mondayQuery } from "./client";

const UPDATES_LIMIT = 50;

const ItemSchema = z.object({
  items: z.array(
    z.object({
      board: z.object({ id: z.union([z.string(), z.number()]) }).nullable(),
      column_values: z.array(z.object({ id: z.string(), text: z.string().nullable() })),
      updates: z.array(RawUpdateSchema).nullable(),
    }),
  ),
});

/**
 * The item's brief and its updates, read with the person's own token so monday applies their permissions. Null when the
 * id is not an item of this board: their token reaches other boards too.
 */
export async function readConversation(itemId: string, token: string): Promise<Conversation | null> {
  const { items } = ItemSchema.parse(
    await mondayQuery(
      `query ($ids: [ID!], $columns: [String!]) {
        items(ids: $ids) {
          board { id }
          column_values(ids: $columns) { id text }
          updates(limit: ${UPDATES_LIMIT}) {
            id text_body created_at creator { id name photo_thumb_small }
            replies { id text_body created_at creator { id name photo_thumb_small } }
          }
        }
      }`,
      { ids: [itemId], columns: [COLUMNS.brief] },
      { token },
    ),
  );
  const item = items[0];
  if (!item || String(item.board?.id) !== String(BOARD_ID)) return null;
  const brief = item.column_values.find((value) => value.id === COLUMNS.brief)?.text ?? null;
  return toConversation(brief, item.updates ?? []);
}

const CreatedSchema = z.object({ create_update: z.object({ id: z.union([z.string(), z.number()]) }) });

/** Posts as the person themselves; the caller has already checked item and parent. */
export async function postUpdate(itemId: string, text: string, parentId: string | null, token: string, idempotencyKey: string): Promise<string> {
  const { create_update } = CreatedSchema.parse(
    await mondayQuery(
      `mutation ($item: ID!, $body: String!, $parent: ID) { create_update(item_id: $item, body: $body, parent_id: $parent) { id } }`,
      { item: itemId, body: commentHtml(text), parent: parentId },
      { idempotencyKey, token },
    ),
  );
  return String(create_update.id);
}
