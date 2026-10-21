import "server-only";
import { z } from "zod";
import { CAMPAIGN_PORTFOLIO, type DateRange } from "../campaign-intake";
import { STATUS_COLUMN } from "../dependencies";
import { mondayQuery } from "./client";
import { unblockDependents } from "./unblock";

/** Pieces shared by every flow that copies a monday Project template into one board per project. */

const MONDAY_HOST = "https://atfx.monday.com";
export const DEPENDENCY_COLUMN = "project_dependency";
// duplicate_board copies items in the background: seconds when monday is idle, past a minute when two run at once.
const SETTLE_TRIES = 80;
const SETTLE_INTERVAL_MS = 3000;

const CopySchema = z.object({
  boards: z.array(
    z.object({
      items_count: z.number().nullable(),
      columns: z.array(z.object({ settings: z.object({ labels: z.array(z.object({ id: z.number(), is_done: z.boolean().optional() })) }) })),
      items_page: z.object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            group: z.object({ id: z.string() }),
            column_values: z.array(z.object({ id: z.string(), text: z.string().nullable().optional(), linked_item_ids: z.array(z.string()).optional() })),
          }),
        ),
      }),
    }),
  ),
});
export type ProjectBoard = z.infer<typeof CopySchema>["boards"][number];
export type ProjectTask = ProjectBoard["items_page"]["items"][number];

const DuplicateSchema = z.object({ duplicate_board: z.object({ board: z.object({ id: z.string() }) }) });
const WebhooksSchema = z.object({ webhooks: z.array(z.object({ event: z.string() })) });
const NamedItemsSchema = z.object({ boards: z.array(z.object({ items_page: z.object({ items: z.array(z.object({ id: z.string() })) }) })) });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const boardUrl = (id: string | number) => `${MONDAY_HOST}/boards/${id}`;

export const cellText = (task: ProjectTask, columnId: string) => task.column_values.find((value) => value.id === columnId)?.text ?? null;

/** The board's tasks with the given columns. Status and timeline on Project boards only read with CALCULATED. */
export async function readBoard(boardId: string | number, columnIds: string[]): Promise<ProjectBoard | null> {
  const { boards } = CopySchema.parse(
    await mondayQuery(
      `query ($board: [ID!], $columns: [String!]) { boards(ids: $board) {
        items_count
        columns(ids: ["${STATUS_COLUMN}"]) { settings }
        items_page(limit: 200) { items { id name group { id }
          column_values(ids: $columns, capabilities: [CALCULATED]) { id text ... on DependencyValue { linked_item_ids } }
        } }
      } }`,
      { board: [boardId], columns: [...new Set([...columnIds, DEPENDENCY_COLUMN])] },
    ),
  );
  return boards[0] ?? null;
}

const dependencyLinks = (board: ProjectBoard) =>
  board.items_page.items.reduce((sum, item) => sum + (item.column_values.find((value) => value.id === DEPENDENCY_COLUMN)?.linked_item_ids?.length ?? 0), 0);

/** Waits until the copy holds every task and every dependency link of the template; null if it never gets there. */
export async function settledCopy(copyId: string, template: ProjectBoard, columnIds: string[]): Promise<ProjectBoard | null> {
  const wantItems = template.items_count ?? template.items_page.items.length;
  const wantLinks = dependencyLinks(template);
  for (let attempt = 0; attempt < SETTLE_TRIES; attempt++) {
    await sleep(SETTLE_INTERVAL_MS);
    const copy = await readBoard(copyId, columnIds);
    if (copy && copy.items_page.items.length >= wantItems && dependencyLinks(copy) >= wantLinks) return copy;
  }
  return null;
}

export async function setColumns(boardId: string | number, itemId: string, values: Record<string, unknown>): Promise<void> {
  await mondayQuery(
    `mutation ($board: ID!, $item: ID!, $values: JSON!) { change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
    { board: boardId, item: itemId, values: JSON.stringify(values) },
  );
}

export async function comment(itemId: number, body: string): Promise<void> {
  await mondayQuery(`mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, { item: itemId, body });
}

export interface Placement {
  workspaceId: number;
  folderId: number;
}

/** The Idempotency-Key makes a repeated webhook return the same copy instead of a second board. */
export async function duplicateBoard(templateId: number, name: string, placement: Placement, idempotencyKey: string): Promise<string> {
  const { duplicate_board } = DuplicateSchema.parse(
    await mondayQuery(
      `mutation ($board: ID!, $name: String!, $workspace: ID!, $folder: ID!) {
        duplicate_board(board_id: $board, duplicate_type: duplicate_board_with_pulses, board_name: $name, workspace_id: $workspace, folder_id: $folder, keep_subscribers: false) { board { id } }
      }`,
      { board: templateId, name, workspace: placement.workspaceId, folder: placement.folderId },
      { idempotencyKey },
    ),
  );
  return duplicate_board.board.id;
}

/** Every later Done on the copy reaches the hub, which releases the next step. Subscribed once per board. */
export async function subscribeDependencies(copyId: string, origin: string): Promise<void> {
  const secret = process.env.MONDAY_WEBHOOK_SECRET;
  const { webhooks } = WebhooksSchema.parse(await mondayQuery(`query ($board: ID!) { webhooks(board_id: $board) { event } }`, { board: copyId }));
  if (secret && !webhooks.some((hook) => hook.event === "change_specific_column_value")) {
    await mondayQuery(
      `mutation ($board: ID!, $url: String!, $config: JSON!) { create_webhook(board_id: $board, url: $url, event: change_specific_column_value, config: $config) { id } }`,
      { board: copyId, url: `${origin}/api/monday/webhook/${secret}/dependencies`, config: JSON.stringify({ columnId: STATUS_COLUMN }) },
    );
  }
}

/** Marks the step done and opens the steps that only waited on it. */
export async function completeStep(copyId: string, copy: ProjectBoard, stepId: string): Promise<void> {
  const done = copy.columns[0]?.settings.labels.find((label) => label.is_done);
  if (!done) return;
  await setColumns(copyId, stepId, { [STATUS_COLUMN]: { index: done.id } });
  await unblockDependents(Number(copyId), Number(stepId));
}

/** One Portfolio line per project, skipped when a line with the same name already exists. */
export async function addToPortfolio(name: string, scope: string, span: DateRange | null): Promise<void> {
  const existing = NamedItemsSchema.parse(
    await mondayQuery(
      `query ($board: [ID!], $name: CompareValue!) { boards(ids: $board) { items_page(limit: 1, query_params: { rules: [{ column_id: "name", compare_value: $name, operator: any_of }] }) { items { id } } } }`,
      { board: [CAMPAIGN_PORTFOLIO.boardId], name: [name] },
    ),
  ).boards[0]?.items_page.items.length;
  if (existing) return;
  await mondayQuery(`mutation ($board: ID!, $name: String!, $values: JSON!) { create_item(board_id: $board, item_name: $name, column_values: $values) { id } }`, {
    board: CAMPAIGN_PORTFOLIO.boardId,
    name,
    values: JSON.stringify({
      [CAMPAIGN_PORTFOLIO.scope]: scope,
      ...(span ? { [CAMPAIGN_PORTFOLIO.plannedTimeline]: span } : {}),
    }),
  });
}
