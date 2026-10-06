import "server-only";
import { z } from "zod";
import { BOARD_ID, STAGE_GROUP, type Area } from "../board-config";
import type { Estimate } from "../estimate";
import type { IntakeRequest } from "../intake/schema";
import { mondayQuery } from "./client";
import { buildColumnValues, type Requester } from "./columns";

const OwnersSchema = z.record(z.string(), z.array(z.number().int().positive()));

/**
 * Area owners as monday user ids, from MONDAY_AREA_OWNERS ({"web":[123],"video":[456]}). Optional: without it the item
 * lands unassigned and a monday automation can assign it, so changing an owner never needs a deploy.
 */
export function ownersFor(area: Area): number[] {
  const raw = process.env.MONDAY_AREA_OWNERS;
  if (!raw) return [];
  try {
    return OwnersSchema.parse(JSON.parse(raw))[area] ?? [];
  } catch (error) {
    console.error("MONDAY_AREA_OWNERS no es JSON válido; la solicitud se crea sin owner", error);
    return [];
  }
}

const CreatedSchema = z.object({ create_item: z.object({ id: z.string() }) });

export async function createRequestItem(
  request: IntakeRequest,
  requester: Requester,
  result: Estimate,
  idempotencyKey: string,
): Promise<string> {
  const columnValues = buildColumnValues(request, requester, result, ownersFor(request.area));
  const created = CreatedSchema.parse(
    await mondayQuery(
      `mutation ($board: ID!, $group: String!, $name: String!, $values: JSON!) {
        create_item(board_id: $board, group_id: $group, item_name: $name, column_values: $values, create_labels_if_missing: false) { id }
      }`,
      {
        board: BOARD_ID,
        group: STAGE_GROUP[result.initialStage],
        name: request.title,
        values: JSON.stringify(columnValues),
      },
      { idempotencyKey },
    ),
  );
  const itemId = created.create_item.id;

  if (request.attachments.length > 0) {
    // The File column cannot be filled on create; links in an update keep the files one click away without re-uploading.
    const list = request.attachments.map((file) => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(file.name)}</a></li>`).join("");
    await mondayQuery(
      `mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,
      { item: itemId, body: `<p>Adjuntos de la solicitud</p><ul>${list}</ul>` },
      { idempotencyKey: `${idempotencyKey}:attachments` },
    );
  }
  return itemId;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
