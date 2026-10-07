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
  if (step === "area" && !draft.area) errors.area = "Elige un área para continuar.";
  if (step === "brief") {
    if (draft.title.trim().length < MIN_TITLE) errors.title = "Escribe un título.";
    if (!draft.subtype) errors.subtype = "Elige el tipo de pieza.";
    if (draft.area === "web" && draft.subtype === "landing" && !draft.landingSubtype) errors.landingSubtype = "Elige el tipo de landing.";
    if (draft.brief.trim().length < MIN_BRIEF) errors.brief = `Cuéntanos un poco más (mínimo ${MIN_BRIEF} caracteres).`;
  }
  if (step === "requisitos") {
    if (details.url?.trim() && !HTTPS.test(details.url.trim())) errors.url = "Pega el link completo, empieza con https://";
    if (details.duration?.trim() && !DIGITS.test(details.duration.trim())) errors.duration = "Escribe solo los segundos, por ejemplo 30.";
    if (details.attendees?.trim() && !DIGITS.test(details.attendees.trim())) errors.attendees = "Escribe solo el número de personas.";
  }
  if (step === "cuando") {
    if (!draft.dueDate) errors.dueDate = "Elige la fecha requerida.";
    if (!draft.market) errors.market = "Elige el mercado.";
  }
  if (step === "material") {
    if (draft.drive.trim() && !HTTPS.test(draft.drive.trim())) errors.drive = "Pega el link completo, empieza con https://";
    if (state.pendingUploads) errors.attachments = "Espera a que terminen de subir los adjuntos, o quita los que fallaron.";
  }
  return errors;
}
