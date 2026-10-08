import "server-only";
import { z } from "zod";
import { AREA_TEAM, BOARD_ID, STAGE_GROUP, type Area } from "../board-config";
import type { Estimate } from "../estimate";
import type { IntakeRequest } from "../intake/schema";
import { MondayError, mondayQuery } from "./client";
import { buildColumnValues, type Requester } from "./columns";

const OwnersSchema = z.record(z.string(), z.array(z.number().int().positive()));

/**
 * Area owners as monday user ids: the team core (AREA_TEAM), unless MONDAY_AREA_OWNERS ({"web":[123]}) overrides it,
 * so covering for someone on leave needs an env change and not a deploy.
 */
export function configuredOwners(): Partial<Record<Area, number[]>> {
  const raw = process.env.MONDAY_AREA_OWNERS;
  if (!raw) return AREA_TEAM;
  try {
    return OwnersSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.error("MONDAY_AREA_OWNERS is not valid JSON; the team core assigns the request", error);
    return AREA_TEAM;
  }
}

export function ownersFor(area: Area): number[] {
  return configuredOwners()[area] ?? [];
}

const CreatedSchema = z.object({ create_item: z.object({ id: z.string() }) });

/** monday refused the action for this user, as opposed to an outage or a bad payload. */
export function isPermissionError(error: unknown): boolean {
  return error instanceof MondayError && /unauthori[sz]ed|permission/i.test(`${error.code ?? ""} ${error.message}`);
}

/**
 * Runs a write as the requester so monday records it under their name, and keeps the hub's own token off writes. Only a
 * permission refusal falls back to the hub's token: monday rejects those before writing anything, so nothing is doubled.
 */
export async function asRequesterOrHub<T>(
  userToken: string | undefined,
  run: (token: string | undefined) => Promise<T>,
): Promise<{ value: T; token: string | undefined }> {
  if (!userToken) return { value: await run(undefined), token: undefined };
  try {
    return { value: await run(userToken), token: userToken };
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    return { value: await run(undefined), token: undefined };
  }
}

export async function createRequestItem(
  request: IntakeRequest,
  requester: Requester,
  result: Estimate,
  idempotencyKey: string,
  requesterToken?: string,
): Promise<string> {
  const columnValues = buildColumnValues(request, requester, result, ownersFor(request.area));
  const { value: created, token } = await asRequesterOrHub(requesterToken, async (token) =>
    CreatedSchema.parse(
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
      { idempotencyKey, token },
      ),
    ),
  );
  const itemId = created.create_item.id;

  if (request.attachments.length > 0) {
    // The File column cannot be filled on create; links in an update keep the files one click away without re-uploading.
    const list = request.attachments.map((file) => `<li><a href="${escapeHtml(file.url)}">${escapeHtml(file.name)}</a></li>`).join("");
    await mondayQuery(
      `mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`,
      { item: itemId, body: `<p>Request attachments</p><ul>${list}</ul>` },
      { idempotencyKey: `${idempotencyKey}:attachments`, token },
    );
  }
  return itemId;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
