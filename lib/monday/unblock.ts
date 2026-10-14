import "server-only";
import { z } from "zod";
import { DEPENDENCY_COLUMN, READY_LABEL, STATUS_COLUMN, unblockedBy, type StatusLabel, type Task } from "../dependencies";
import { mondayQuery } from "./client";

const PAGE_SIZE = 500;

// capabilities: [CALCULATED] is what makes a multi-level board return its status at all, and there it arrives as a
// BatteryValue with one key per leaf; a classic board keeps StatusValue. Both shapes are read.
const TASK_FIELDS = `id column_values(ids: ["${STATUS_COLUMN}", "${DEPENDENCY_COLUMN}"], capabilities: [CALCULATED]) {
  id
  ... on StatusValue { index is_leaf }
  ... on BatteryValue { is_leaf battery_value { key count } }
  ... on DependencyValue { linked_item_ids }
}`;

const CellSchema = z.object({
  id: z.string(),
  index: z.number().nullable().optional(),
  is_leaf: z.boolean().optional(),
  battery_value: z.array(z.object({ key: z.coerce.number(), count: z.number() })).optional(),
  linked_item_ids: z.array(z.string()).optional(),
});
const ItemSchema = z.object({ id: z.string(), column_values: z.array(CellSchema) });
const PageSchema = z.object({ cursor: z.string().nullable(), items: z.array(ItemSchema) });

const BoardSchema = z.object({
  boards: z.array(
    z.object({
      columns: z.array(z.object({ settings: z.object({ labels: z.array(z.object({ id: z.number(), label: z.string(), is_done: z.boolean().optional() })) }) })),
      items_page: PageSchema,
    }),
  ),
});
const NextPageSchema = z.object({ next_items_page: PageSchema });

function toTask(item: z.infer<typeof ItemSchema>): Task {
  const status = item.column_values.find((cell) => cell.id === STATUS_COLUMN);
  const dependency = item.column_values.find((cell) => cell.id === DEPENDENCY_COLUMN);
  const battery = status?.battery_value;
  return {
    id: item.id,
    // A leaf's battery holds exactly its own label; more than one key means a rollup, which is never acted on.
    status: status?.index ?? (battery?.length === 1 ? battery[0].key : null),
    dependsOn: dependency?.linked_item_ids ?? [],
    leaf: status?.is_leaf ?? true,
  };
}

// HACK: reads the whole board per status change. Fine for project boards of tens of tasks; move to an items_page
// filter on the dependency column if a board passes a few hundred items.
async function readBoard(boardId: number): Promise<{ labels: StatusLabel[]; tasks: Task[] } | null> {
  const first = BoardSchema.parse(
    await mondayQuery(
      `query ($board: [ID!]) { boards(ids: $board) {
        columns(ids: ["${STATUS_COLUMN}"]) { settings }
        items_page(limit: ${PAGE_SIZE}) { cursor items { ${TASK_FIELDS} } }
      } }`,
      { board: [boardId] },
    ),
  ).boards[0];
  // A board without the Project status column is not a project board: nothing to unblock.
  const column = first?.columns[0];
  if (!first || !column) return null;

  const items = [...first.items_page.items];
  let cursor = first.items_page.cursor;
  while (cursor) {
    const page = NextPageSchema.parse(
      await mondayQuery(`query ($cursor: String!) { next_items_page(limit: ${PAGE_SIZE}, cursor: $cursor) { cursor items { ${TASK_FIELDS} } } }`, { cursor }),
    ).next_items_page;
    items.push(...page.items);
    cursor = page.cursor;
  }

  const labels = column.settings.labels.map((label) => ({ id: label.id, label: label.label, done: label.is_done ?? false }));
  return { labels, tasks: items.map(toTask) };
}

/** Moves the tasks that `itemId` was holding back from Bloqueada to Lista para empezar. Returns the ids it moved. */
export async function unblockDependents(boardId: number, itemId: number): Promise<string[]> {
  const board = await readBoard(boardId);
  if (!board) return [];
  const ready = board.labels.find((label) => label.label === READY_LABEL);
  if (!ready) return [];

  const released = unblockedBy(String(itemId), board.tasks, board.labels);
  for (const id of released) {
    await mondayQuery(
      `mutation ($board: ID!, $item: ID!, $column: String!, $value: JSON!) {
        change_column_value(board_id: $board, item_id: $item, column_id: $column, value: $value) { id }
      }`,
      { board: boardId, item: id, column: STATUS_COLUMN, value: JSON.stringify({ index: ready.id }) },
    );
  }
  return released;
}
