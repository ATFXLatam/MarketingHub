import type { Area, Priority } from "@/lib/board-config";

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
}

const MIN_TITLE = 3;
const MIN_BRIEF = 20;

/** Per-step checks so Continue stops on the step with the problem; the server schema still has the final word. */
export function stepErrors(step: number, draft: Draft, state: { pendingUploads: boolean }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 0 && !draft.area) errors.area = "Elige un área para continuar.";
  if (step === 1) {
    if (draft.title.trim().length < MIN_TITLE) errors.title = "Escribe un título.";
    if (!draft.subtype) errors.subtype = "Elige el tipo de pieza.";
    if (draft.area === "web" && draft.subtype === "landing" && !draft.landingSubtype) errors.landingSubtype = "Elige el tipo de landing.";
    if (draft.brief.trim().length < MIN_BRIEF) errors.brief = `Cuéntanos un poco más (mínimo ${MIN_BRIEF} caracteres).`;
  }
  if (step === 2) {
    if (!draft.dueDate) errors.dueDate = "Elige la fecha requerida.";
    if (!draft.market) errors.market = "Elige el mercado.";
  }
  if (step === 3) {
    if (draft.drive.trim() && !/^https:\/\//.test(draft.drive.trim())) errors.drive = "Pega el link completo, empieza con https://";
    if (state.pendingUploads) errors.attachments = "Espera a que terminen de subir los adjuntos, o quita los que fallaron.";
  }
  return errors;
}
