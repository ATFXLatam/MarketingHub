import {
  AREA_LABEL_ID,
  COLUMNS,
  LANDING_SUBTYPES,
  PRIORITY_LABEL_ID,
  STAGE_LABEL_ID,
  SUBTYPE_COLUMN,
  subtypeOf,
} from "../board-config";
import type { Estimate } from "../estimate";
import type { IntakeRequest } from "../intake/schema";

/** Column value shapes from the monday API reference (2026-07). Labels go by id so a renamed label never breaks a write. */
export const status = (labelId: number) => ({ index: labelId });
export const dropdown = (labelIds: number[]) => ({ ids: labelIds });
export const date = (isoDate: string) => ({ date: isoDate });
export const link = (url: string, text: string) => ({ url, text });
export const email = (address: string) => ({ email: address, text: address });
export const people = (ids: number[]) => ({ personsAndTeams: ids.map((id) => ({ id, kind: "person" as const })) });
export const longText = (text: string) => ({ text });

export interface Requester {
  name: string;
  email: string;
}

export function buildColumnValues(
  request: IntakeRequest,
  requester: Requester,
  result: Estimate,
  ownerIds: number[],
): Record<string, unknown> {
  const subtype = subtypeOf(request.area, request.subtype);
  const values: Record<string, unknown> = {
    [COLUMNS.status]: status(STAGE_LABEL_ID[result.initialStage]),
    [COLUMNS.area]: status(AREA_LABEL_ID[request.area]),
    [COLUMNS.priority]: status(PRIORITY_LABEL_ID[request.priority]),
    [COLUMNS.slaDays]: String(result.days),
    [COLUMNS.requesterName]: requester.name,
    [COLUMNS.requesterEmail]: email(requester.email),
    [COLUMNS.dueDate]: date(request.dueDate),
    [COLUMNS.brief]: longText(request.brief),
    [COLUMNS.market]: request.market,
  };
  if (subtype) values[SUBTYPE_COLUMN[request.area]] = dropdown([subtype.labelId]);
  if (request.drive) values[COLUMNS.drive] = link(request.drive, "Carpeta Drive");
  if (ownerIds.length > 0) values[COLUMNS.owner] = people(ownerIds);
  if (request.area === "web") {
    const landing = LANDING_SUBTYPES.find((item) => item.value === request.landingSubtype);
    if (request.subtype === "landing" && landing) values[COLUMNS.landingSubtype] = dropdown([landing.labelId]);
    if (request.blockers) values[COLUMNS.blockers] = longText(request.blockers);
  }
  return values;
}
