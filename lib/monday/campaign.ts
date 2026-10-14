import "server-only";
import { z } from "zod";
import { AFFILIATE_INTAKE, boardIdFromLink, CAMPAIGN_PORTFOLIO, CAMPAIGN_TEMPLATE, campaignBoardName, parseRange, shiftTimelines, spanOf } from "../campaign-intake";
import { STATUS_COLUMN } from "../dependencies";
import { mondayQuery } from "./client";
import { unblockDependents } from "./unblock";

const MONDAY_HOST = "https://atfx.monday.com";
// duplicate_board copies items in the background: seconds when monday is idle, past a minute when two run at once.
const SETTLE_TRIES = 80;
const SETTLE_INTERVAL_MS = 3000;

const cell = z.object({ id: z.string(), text: z.string().nullable() });

const RequestSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), column_values: z.array(cell) })),
});

const DuplicateSchema = z.object({ duplicate_board: z.object({ board: z.object({ id: z.string() }) }) });

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
type Copy = z.infer<typeof CopySchema>["boards"][number];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const boardUrl = (id: string | number) => `${MONDAY_HOST}/boards/${id}`;

async function readRequest(itemId: number) {
  const { items } = RequestSchema.parse(
    await mondayQuery(`query ($item: [ID!], $columns: [String!]) { items(ids: $item) { id name column_values(ids: $columns) { id text } } }`, {
      item: [itemId],
      columns: [AFFILIATE_INTAKE.status, AFFILIATE_INTAKE.campaignLink, AFFILIATE_INTAKE.affiliate, AFFILIATE_INTAKE.product, AFFILIATE_INTAKE.launch],
    }),
  );
  const item = items[0];
  if (!item) return null;
  const text = (id: string) => item.column_values.find((value) => value.id === id)?.text?.trim() ?? "";
  return {
    name: item.name,
    status: text(AFFILIATE_INTAKE.status),
    campaignLink: text(AFFILIATE_INTAKE.campaignLink),
    affiliate: text(AFFILIATE_INTAKE.affiliate),
    product: text(AFFILIATE_INTAKE.product),
    launch: text(AFFILIATE_INTAKE.launch),
  };
}

async function readBoard(boardId: string | number): Promise<Copy | null> {
  const { boards } = CopySchema.parse(
    await mondayQuery(
      `query ($board: [ID!]) { boards(ids: $board) {
        items_count
        columns(ids: ["${STATUS_COLUMN}"]) { settings }
        items_page(limit: 200) { items { id name group { id }
          column_values(ids: ["${CAMPAIGN_TEMPLATE.timeline}", "project_dependency"], capabilities: [CALCULATED]) { id text ... on DependencyValue { linked_item_ids } }
        } }
      } }`,
      { board: [boardId] },
    ),
  );
  return boards[0] ?? null;
}

const dependencyLinks = (board: Copy) =>
  board.items_page.items.reduce((sum, item) => sum + (item.column_values.find((value) => value.id === "project_dependency")?.linked_item_ids?.length ?? 0), 0);

/** Waits until the copy holds every task and every dependency link of the template; null if it never gets there. */
async function settledCopy(copyId: string, template: Copy): Promise<Copy | null> {
  const wantItems = template.items_count ?? template.items_page.items.length;
  const wantLinks = dependencyLinks(template);
  for (let attempt = 0; attempt < SETTLE_TRIES; attempt++) {
    await sleep(SETTLE_INTERVAL_MS);
    const copy = await readBoard(copyId);
    if (copy && copy.items_page.items.length >= wantItems && dependencyLinks(copy) >= wantLinks) return copy;
  }
  return null;
}

async function setColumns(boardId: string | number, itemId: string, values: Record<string, unknown>): Promise<void> {
  await mondayQuery(
    `mutation ($board: ID!, $item: ID!, $values: JSON!) { change_multiple_column_values(board_id: $board, item_id: $item, column_values: $values) { id } }`,
    { board: boardId, item: itemId, values: JSON.stringify(values) },
  );
}

async function comment(itemId: number, body: string): Promise<void> {
  await mondayQuery(`mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, { item: itemId, body });
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Turns an Accepted affiliate request into its own campaign board: a copy of the MVP board without the setup group,
 * dated from today, with the request step done, the dependency webhook subscribed and a Portfolio entry. The request's
 * Campaign board link is written right after the copy, so a repeated webhook never makes a second board; moving an
 * unfinished request back to Accepted finishes the board it already has.
 */
export async function spawnCampaign(requestId: number, origin: string): Promise<string | null> {
  const request = await readRequest(requestId);
  if (!request || request.status !== AFFILIATE_INTAKE.acceptedLabel) return null;

  const template = await readBoard(CAMPAIGN_TEMPLATE.boardId);
  if (!template) throw new Error(`template board ${CAMPAIGN_TEMPLATE.boardId} not readable`);

  const name = campaignBoardName(request.name);
  const copyId = boardIdFromLink(request.campaignLink) ?? (await duplicateTemplate(requestId, name));

  const copy = await settledCopy(copyId, template);
  if (!copy) {
    await comment(requestId, `Campaign board still copying: ${boardUrl(copyId)}. Move this request out of Accepted and back to finish it.`);
    return copyId;
  }
  // The setup group is archived last, so a board without it is finished and a re-run leaves it alone.
  if (!copy.items_page.items.some((item) => item.group.id === CAMPAIGN_TEMPLATE.setupGroup)) return copyId;

  await finishCampaign(copyId, copy, name, request, requestId, origin);
  return copyId;
}

async function duplicateTemplate(requestId: number, name: string): Promise<string> {
  const { duplicate_board } = DuplicateSchema.parse(
    await mondayQuery(
      `mutation ($board: ID!, $name: String!, $workspace: ID!, $folder: ID!) {
        duplicate_board(board_id: $board, duplicate_type: duplicate_board_with_pulses, board_name: $name, workspace_id: $workspace, folder_id: $folder, keep_subscribers: false) { board { id } }
      }`,
      { board: CAMPAIGN_TEMPLATE.boardId, name, workspace: CAMPAIGN_TEMPLATE.workspaceId, folder: CAMPAIGN_TEMPLATE.folderId },
      { idempotencyKey: `campaign-board-${requestId}` },
    ),
  );
  const copyId = duplicate_board.board.id;
  await setColumns(AFFILIATE_INTAKE.boardId, String(requestId), { [AFFILIATE_INTAKE.campaignLink]: { url: boardUrl(copyId), text: name } });
  return copyId;
}

const WebhooksSchema = z.object({ webhooks: z.array(z.object({ event: z.string() })) });
const NamedItemsSchema = z.object({ boards: z.array(z.object({ items_page: z.object({ items: z.array(z.object({ id: z.string() })) }) })) });

async function finishCampaign(
  copyId: string,
  copy: Copy,
  name: string,
  request: NonNullable<Awaited<ReturnType<typeof readRequest>>>,
  requestId: number,
  origin: string,
): Promise<void> {
  const tasks = copy.items_page.items.filter((item) => item.group.id !== CAMPAIGN_TEMPLATE.setupGroup);
  const shifted = shiftTimelines(
    tasks.map((item) => ({ id: item.id, range: parseRange(item.column_values.find((value) => value.id === CAMPAIGN_TEMPLATE.timeline)?.text) })),
    todayUtc(),
  );
  for (const { id, range } of shifted) await setColumns(copyId, id, { [CAMPAIGN_TEMPLATE.timeline]: range });

  // Subscribed before the request step is closed, so every later Done on this board releases the next step.
  const secret = process.env.MONDAY_WEBHOOK_SECRET;
  const { webhooks } = WebhooksSchema.parse(await mondayQuery(`query ($board: ID!) { webhooks(board_id: $board) { event } }`, { board: copyId }));
  if (secret && !webhooks.some((hook) => hook.event === "change_specific_column_value")) {
    await mondayQuery(
      `mutation ($board: ID!, $url: String!, $config: JSON!) { create_webhook(board_id: $board, url: $url, event: change_specific_column_value, config: $config) { id } }`,
      { board: copyId, url: `${origin}/api/monday/webhook/${secret}/dependencies`, config: JSON.stringify({ columnId: STATUS_COLUMN }) },
    );
  }

  const done = copy.columns[0]?.settings.labels.find((label) => label.is_done);
  const requestStep = tasks.find((item) => item.group.id === CAMPAIGN_TEMPLATE.requestGroup && item.name.trim().startsWith("1."));
  if (done && requestStep) {
    await setColumns(copyId, requestStep.id, { [STATUS_COLUMN]: { index: done.id } });
    await unblockDependents(Number(copyId), Number(requestStep.id));
  }

  const span = spanOf(shifted.map((task) => task.range));
  const existing = NamedItemsSchema.parse(
    await mondayQuery(
      `query ($board: [ID!], $name: CompareValue!) { boards(ids: $board) { items_page(limit: 1, query_params: { rules: [{ column_id: "name", compare_value: $name, operator: any_of }] }) { items { id } } } }`,
      { board: [CAMPAIGN_PORTFOLIO.boardId], name: [name] },
    ),
  ).boards[0]?.items_page.items.length;
  if (!existing) {
    await mondayQuery(
      `mutation ($board: ID!, $name: String!, $values: JSON!) { create_item(board_id: $board, item_name: $name, column_values: $values) { id } }`,
      {
        board: CAMPAIGN_PORTFOLIO.boardId,
        name,
        values: JSON.stringify({
          [CAMPAIGN_PORTFOLIO.scope]: [`Affiliate: ${request.affiliate || "-"}`, `Product: ${request.product || "-"}`, `Board: ${boardUrl(copyId)}`].join(" · "),
          ...(span ? { [CAMPAIGN_PORTFOLIO.plannedTimeline]: span } : {}),
        }),
      },
    );
  }

  await mondayQuery(`mutation ($board: ID!, $group: String!) { archive_group(board_id: $board, group_id: $group) { id } }`, {
    board: copyId,
    group: CAMPAIGN_TEMPLATE.setupGroup,
  });

  const launch = request.launch && span && request.launch < span.to ? ` The requested launch (${request.launch}) is before the planned end (${span.to}).` : "";
  await comment(requestId, `Campaign board ready: ${boardUrl(copyId)}. Planned ${span ? `${span.from} to ${span.to}` : "without dates"}.${launch}`);
}
