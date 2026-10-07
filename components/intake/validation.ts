import type { Area, Priority } from "@/lib/board-config";
import type { Details } from "@/lib/requirements";

export interface Draft {
  title: string;
  area: Area | "";
  subtype: string;
  landingSubtype: string;
  priority: Priority;
  market: string;
  dueDate?: Date;
  brief: string;
  drive: string;
  blockers: string;
  details: Details;
}

const MIN_TITLE = 3;
const MIN_BRIEF = 20;
const HTTPS = /^https:\/\//;
const DIGITS = /^\d{1,6}$/;

/** Per-step checks so Continue stops on the step with the problem; the server schema still has the final word. */
export function stepErrors(step: string, draft: Draft, state: { pendingUploads: boolean }): Record<string, string> {
  const errors: Record<string, string> = {};
  const { details } = draft;
  if (step === "area" && !draft.area) errors.area = "Choose an area to continue.";
  if (step === "brief") {
    if (draft.title.trim().length < MIN_TITLE) errors.title = "Enter a title.";
    if (!draft.subtype) errors.subtype = "Choose the piece type.";
    if (draft.area === "web" && draft.subtype === "landing" && !draft.landingSubtype) errors.landingSubtype = "Choose the landing type.";
    if (draft.brief.trim().length < MIN_BRIEF) errors.brief = `Tell us a bit more (at least ${MIN_BRIEF} characters).`;
  }
  if (step === "requisitos") {
    if (details.url?.trim() && !HTTPS.test(details.url.trim())) errors.url = "Paste the full link, starting with https://";
    if (details.duration?.trim() && !DIGITS.test(details.duration.trim())) errors.duration = "Enter seconds only, for example 30.";
    if (details.attendees?.trim() && !DIGITS.test(details.attendees.trim())) errors.attendees = "Enter the number of people only.";
  }
  if (step === "cuando") {
    if (!draft.dueDate) errors.dueDate = "Choose the due date.";
    if (!draft.market) errors.market = "Choose the market.";
  }
  if (step === "material") {
    if (draft.drive.trim() && !HTTPS.test(draft.drive.trim())) errors.drive = "Paste the full link, starting with https://";
    if (state.pendingUploads) errors.attachments = "Wait for the attachments to finish uploading, or remove the ones that failed.";
  }
  return errors;
}
