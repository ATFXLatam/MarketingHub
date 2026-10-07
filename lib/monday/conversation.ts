import "server-only";
import { z } from "zod";
import { BOARD_ID, COLUMNS } from "../board-config";
import { commentHtml, RawUpdateSchema, toConversation, type Conversation } from "../conversation";
import { mondayQuery } from "./client";

const UPDATES_LIMIT = 50;

const ItemSchema = z.object({
  me: z.object({ id: z.union([z.string(), z.number()]) }).nullable(),
  items: z.array(
    z.object({
      board: z.object({ id: z.union([z.string(), z.number()]) }).nullable(),
      column_values: z.array(z.object({ id: z.string(), text: z.string().nullable() })),
      updates: z.array(RawUpdateSchema).nullable(),
    }),
  ),
});

/** The item's brief and its updates, or null when the id is not an item of this board: the token reaches other boards too. */
export async function readConversation(itemId: string): Promise<Conversation | null> {
  const { me, items } = ItemSchema.parse(
    await mondayQuery(
      `query ($ids: [ID!], $columns: [String!]) {
        me { id }
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
    ),
  );
  const item = items[0];
  if (!item || String(item.board?.id) !== String(BOARD_ID)) return null;
  const brief = item.column_values.find((value) => value.id === COLUMNS.brief)?.text ?? null;
  return toConversation(brief, item.updates ?? [], me ? String(me.id) : null);
}

const CreatedSchema = z.object({ create_update: z.object({ id: z.union([z.string(), z.number()]) }) });

/** Posts as the token owner with the author's name signed in the body; the caller has already checked item and parent. */
export async function postUpdate(itemId: string, author: string, text: string, parentId: string | null, idempotencyKey: string): Promise<string> {
  const { create_update } = CreatedSchema.parse(
    await mondayQuery(
      `mutation ($item: ID!, $body: String!, $parent: ID) { create_update(item_id: $item, body: $body, parent_id: $parent) { id } }`,
      { item: itemId, body: commentHtml(author, text), parent: parentId },
      { idempotencyKey },
    ),
  );
  return String(create_update.id);
}
