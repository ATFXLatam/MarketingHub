import "server-only";
import { z } from "zod";
import { boardIdFromLink, spanOf } from "../campaign-intake";
import { todayIn } from "../dates";
import { planRetail, RETAIL_INTAKE, RETAIL_TEMPLATE, retailBoardName } from "../retail-intake";
import { mondayQuery } from "./client";
import { addToPortfolio, boardUrl, cellText, comment, completeStep, duplicateBoard, readBoard, setColumns, settledCopy, subscribeDependencies } from "./project-board";

const COLUMNS = [RETAIL_TEMPLATE.timeline, RETAIL_TEMPLATE.startOffset, RETAIL_TEMPLATE.endOffset];

const ItemSchema = z.object({
  items: z.array(z.object({ name: z.string(), column_values: z.array(z.object({ id: z.string(), text: z.string().nullable() })) })),
});

async function readRequest(itemId: number) {
  const { items } = ItemSchema.parse(
    await mondayQuery(`query ($item: [ID!], $columns: [String!]) { items(ids: $item) { name column_values(ids: $columns) { id text } } }`, {
      item: [itemId],
      columns: [RETAIL_INTAKE.status, RETAIL_INTAKE.team, RETAIL_INTAKE.launch, RETAIL_INTAKE.board, RETAIL_INTAKE.startDate],
    }),
  );
  const item = items[0];
  if (!item) return null;
  const text = (id: string) => item.column_values.find((value) => value.id === id)?.text?.trim() ?? "";
  return {
    name: item.name,
    status: text(RETAIL_INTAKE.status),
    team: text(RETAIL_INTAKE.team),
    launch: text(RETAIL_INTAKE.launch),
    board: text(RETAIL_INTAKE.board),
    startDate: text(RETAIL_INTAKE.startDate),
  };
}

const offset = (text: string | null) => (text?.trim() && Number.isFinite(Number(text)) ? Number(text) : null);

/**
 * Turns an Aprobado retail request into its own campaign board: a copy of the template dated in business days from
 * today, the request step done, the dependency webhook subscribed and a Portfolio entry. The board link is written
 * right after the copy, so a repeated webhook never makes a second board; the start date is written last, so a request
 * that has one is finished and a re-run leaves it alone.
 */
export async function spawnRetail(itemId: number, origin: string): Promise<string | null> {
  const request = await readRequest(itemId);
  if (!request || request.status !== RETAIL_INTAKE.approvedLabel || request.startDate) return null;

  const template = await readBoard(RETAIL_TEMPLATE.boardId, COLUMNS);
  if (!template) throw new Error(`template board ${RETAIL_TEMPLATE.boardId} not readable`);

  const name = retailBoardName(request.name);
  let copyId = boardIdFromLink(request.board);
  if (!copyId) {
    copyId = await duplicateBoard(RETAIL_TEMPLATE.boardId, name, RETAIL_TEMPLATE, `retail-board-${itemId}`);
    await setColumns(RETAIL_INTAKE.boardId, String(itemId), { [RETAIL_INTAKE.board]: { url: boardUrl(copyId), text: name } });
  }

  const copy = await settledCopy(copyId, template, COLUMNS);
  if (!copy) {
    await comment(itemId, `El board de la campaña se sigue copiando: ${boardUrl(copyId)}. Sácala de Aprobado y vuelve a ponerla para terminarlo.`);
    return copyId;
  }

  const today = todayIn();
  const tasks = copy.items_page.items;
  const steps = planRetail(
    tasks.map((task) => ({ id: task.id, start: offset(cellText(task, RETAIL_TEMPLATE.startOffset)), end: offset(cellText(task, RETAIL_TEMPLATE.endOffset)) })),
    today,
  );
  for (const { id, range } of steps) await setColumns(copyId, id, { [RETAIL_TEMPLATE.timeline]: range });

  await subscribeDependencies(copyId, origin);

  // The first step (the request, with the topic Ergin approved) is what Thomas or Ergin accepted by approving it.
  const first = tasks.find((task) => task.name.trim().startsWith("1."));
  if (first) await completeStep(copyId, copy, first.id);

  const span = spanOf(steps.map((step) => step.range));
  await addToPortfolio(name, [`Retail: ${request.team || "-"}`, `Board: ${boardUrl(copyId)}`].join(" · "), span);

  await setColumns(RETAIL_INTAKE.boardId, String(itemId), { [RETAIL_INTAKE.startDate]: { date: steps[0]?.range.from ?? today } });
  const late = request.launch && span && request.launch < span.to ? ` La fecha deseada (${request.launch}) es anterior al cierre del plan (${span.to}).` : "";
  await comment(itemId, `Board de la campaña listo: ${boardUrl(copyId)}. Plan ${span ? `del ${span.from} al ${span.to}` : "sin fechas"}.${late}`);
  return copyId;
}
