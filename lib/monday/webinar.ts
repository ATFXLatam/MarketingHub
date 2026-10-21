import "server-only";
import { z } from "zod";
import { boardIdFromLink, spanOf } from "../campaign-intake";
import { todayIn } from "../dates";
import { planWebinar, WEBINAR_INTAKE, WEBINAR_TEMPLATE, webinarBoardName } from "../webinar-intake";
import { mondayQuery } from "./client";
import { addToPortfolio, boardUrl, cellText, comment, completeStep, duplicateBoard, readBoard, setColumns, settledCopy, subscribeDependencies } from "./project-board";

const COLUMNS = [WEBINAR_TEMPLATE.timeline, WEBINAR_TEMPLATE.startOffset, WEBINAR_TEMPLATE.endOffset];

const ItemSchema = z.object({
  items: z.array(z.object({ name: z.string(), column_values: z.array(z.object({ id: z.string(), text: z.string().nullable() })) })),
});

async function readWebinar(itemId: number) {
  const { items } = ItemSchema.parse(
    await mondayQuery(`query ($item: [ID!], $columns: [String!]) { items(ids: $item) { name column_values(ids: $columns) { id text } } }`, {
      item: [itemId],
      columns: [WEBINAR_INTAKE.status, WEBINAR_INTAKE.date, WEBINAR_INTAKE.confirmedDate, WEBINAR_INTAKE.time, WEBINAR_INTAKE.board],
    }),
  );
  const item = items[0];
  if (!item) return null;
  const text = (id: string) => item.column_values.find((value) => value.id === id)?.text?.trim() ?? "";
  return {
    name: item.name,
    status: text(WEBINAR_INTAKE.status),
    date: text(WEBINAR_INTAKE.date),
    confirmedDate: text(WEBINAR_INTAKE.confirmedDate),
    time: text(WEBINAR_INTAKE.time),
    board: text(WEBINAR_INTAKE.board),
  };
}

const offset = (text: string | null) => (text?.trim() && Number.isFinite(Number(text)) ? Number(text) : null);

/**
 * Turns an Aprobado webinar into its own board: a copy of the template with every step dated in business days around
 * the webinar, the first step done, the dependency webhook subscribed and a Portfolio entry. The board link is written
 * right after the copy, so a repeated webhook never makes a second board; the confirmed date is written last, so a
 * webinar that has one is finished and a re-run leaves it alone.
 */
export async function spawnWebinar(itemId: number, origin: string): Promise<string | null> {
  const webinar = await readWebinar(itemId);
  if (!webinar || webinar.status !== WEBINAR_INTAKE.approvedLabel || webinar.confirmedDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(webinar.date)) {
    await comment(itemId, "Falta la fecha del webinar. Agrégala y vuelve a pasarlo a Aprobado para crear su board.");
    return null;
  }

  const template = await readBoard(WEBINAR_TEMPLATE.boardId, COLUMNS);
  if (!template) throw new Error(`template board ${WEBINAR_TEMPLATE.boardId} not readable`);

  const name = webinarBoardName(webinar.name);
  let copyId = boardIdFromLink(webinar.board);
  if (!copyId) {
    copyId = await duplicateBoard(WEBINAR_TEMPLATE.boardId, name, WEBINAR_TEMPLATE, `webinar-board-${itemId}`);
    await setColumns(WEBINAR_INTAKE.boardId, String(itemId), { [WEBINAR_INTAKE.board]: { url: boardUrl(copyId), text: name } });
  }

  const copy = await settledCopy(copyId, template, COLUMNS);
  if (!copy) {
    await comment(itemId, `El board del webinar se sigue copiando: ${boardUrl(copyId)}. Sácalo de Aprobado y vuelve a ponerlo para terminarlo.`);
    return copyId;
  }

  const tasks = copy.items_page.items;
  const plan = planWebinar(
    tasks.map((task) => ({ id: task.id, start: offset(cellText(task, WEBINAR_TEMPLATE.startOffset)), end: offset(cellText(task, WEBINAR_TEMPLATE.endOffset)) })),
    webinar.date,
    todayIn(),
  );
  for (const { id, range } of plan.steps) await setColumns(copyId, id, { [WEBINAR_TEMPLATE.timeline]: range });

  await subscribeDependencies(copyId, origin);

  // The first step (topic, date and goal) is what Thomas approved by moving the webinar to Aprobado.
  const first = tasks.find((task) => task.name.trim().startsWith("01."));
  if (first) await completeStep(copyId, copy, first.id);

  const span = spanOf(plan.steps.map((step) => step.range));
  await addToPortfolio(name, [`Webinar: ${plan.webinar}${webinar.time ? ` ${webinar.time}` : ""}`, `Board: ${boardUrl(copyId)}`].join(" · "), span);

  await setColumns(WEBINAR_INTAKE.boardId, String(itemId), { [WEBINAR_INTAKE.confirmedDate]: { date: plan.webinar } });
  const moved = plan.moved
    ? ` La fecha pedida (${webinar.date}) no le daba al equipo los días hábiles completos, así que el webinar se movió al ${plan.webinar}.`
    : "";
  await comment(itemId, `Board del webinar listo: ${boardUrl(copyId)}. Webinar el ${plan.webinar}${span ? `; pasos del ${span.from} al ${span.to}` : ""}.${moved}`);
  return copyId;
}
