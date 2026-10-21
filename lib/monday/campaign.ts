import "server-only";
import { z } from "zod";
import { AFFILIATE_INTAKE, boardIdFromLink, CAMPAIGN_TEMPLATE, campaignBoardName, parseRange, shiftTimelines, spanOf } from "../campaign-intake";
import { mondayQuery } from "./client";
import {
  addToPortfolio,
  boardUrl,
  cellText,
  comment,
  completeStep,
  duplicateBoard,
  type ProjectBoard,
  readBoard,
  setColumns,
  settledCopy,
  subscribeDependencies,
} from "./project-board";

const COLUMNS = [CAMPAIGN_TEMPLATE.timeline];

const cell = z.object({ id: z.string(), text: z.string().nullable() });

const RequestSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string(), column_values: z.array(cell) })),
});

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

  const template = await readBoard(CAMPAIGN_TEMPLATE.boardId, COLUMNS);
  if (!template) throw new Error(`template board ${CAMPAIGN_TEMPLATE.boardId} not readable`);

  const name = campaignBoardName(request.name);
  const copyId = boardIdFromLink(request.campaignLink) ?? (await duplicateTemplate(requestId, name));

  const copy = await settledCopy(copyId, template, COLUMNS);
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
  const copyId = await duplicateBoard(CAMPAIGN_TEMPLATE.boardId, name, CAMPAIGN_TEMPLATE, `campaign-board-${requestId}`);
  await setColumns(AFFILIATE_INTAKE.boardId, String(requestId), { [AFFILIATE_INTAKE.campaignLink]: { url: boardUrl(copyId), text: name } });
  return copyId;
}

async function finishCampaign(
  copyId: string,
  copy: ProjectBoard,
  name: string,
  request: NonNullable<Awaited<ReturnType<typeof readRequest>>>,
  requestId: number,
  origin: string,
): Promise<void> {
  const tasks = copy.items_page.items.filter((item) => item.group.id !== CAMPAIGN_TEMPLATE.setupGroup);
  const shifted = shiftTimelines(
    tasks.map((item) => ({ id: item.id, range: parseRange(cellText(item, CAMPAIGN_TEMPLATE.timeline)) })),
    todayUtc(),
  );
  for (const { id, range } of shifted) await setColumns(copyId, id, { [CAMPAIGN_TEMPLATE.timeline]: range });

  // Subscribed before the request step is closed, so every later Done on this board releases the next step.
  await subscribeDependencies(copyId, origin);

  const requestStep = tasks.find((item) => item.group.id === CAMPAIGN_TEMPLATE.requestGroup && item.name.trim().startsWith("1."));
  if (requestStep) await completeStep(copyId, copy, requestStep.id);

  const span = spanOf(shifted.map((task) => task.range));
  await addToPortfolio(name, [`Affiliate: ${request.affiliate || "-"}`, `Product: ${request.product || "-"}`, `Board: ${boardUrl(copyId)}`].join(" · "), span);

  await mondayQuery(`mutation ($board: ID!, $group: String!) { archive_group(board_id: $board, group_id: $group) { id } }`, {
    board: copyId,
    group: CAMPAIGN_TEMPLATE.setupGroup,
  });

  const launch = request.launch && span && request.launch < span.to ? ` The requested launch (${request.launch}) is before the planned end (${span.to}).` : "";
  await comment(requestId, `Campaign board ready: ${boardUrl(copyId)}. Planned ${span ? `${span.from} to ${span.to}` : "without dates"}.${launch}`);
}
