import { z } from "zod";
import { AFFILIATE_INTAKE } from "./campaign-intake";
import { BOARD_ID } from "./board-config";
import { RETAIL_INTAKE } from "./retail-intake";

export interface BriefForm {
  formToken: string;
  /** The form's free-text requester name, shown only when it differs from the account that submitted. */
  requester: string;
}

/**
 * Boards fed by a monday form, with that form. Every item they get carries the form's answers in a pinned update, so
 * whoever opens the task reads the whole brief in one place instead of across twenty columns.
 */
export const BRIEF_FORMS: Readonly<Record<number, BriefForm>> = {
  [BOARD_ID]: { formToken: "1db69245acb26fea6719f4a2aa52ad7f", requester: "text_mm5q27rd" },
  [AFFILIATE_INTAKE.boardId]: { formToken: "49abbb29b7ce43c91ad31b39357ef9b0", requester: "short_textxnx81iql" },
  [RETAIL_INTAKE.boardId]: { formToken: RETAIL_INTAKE.formToken, requester: "short_text5toc7zj5" },
};

export interface FormQuestion {
  id: string;
  title: string;
  type: string;
}

// Layout blocks and the item name are not answers: the name is already the task's title.
const NOT_ANSWERS = new Set(["PAGE_BLOCK", "Name", "DISPLAY_TEXT"]);
const PARAGRAPH = new Set(["LongText"]);

const CreatedSchema = z.object({ event: z.object({ boardId: z.coerce.number().int().positive(), pulseId: z.coerce.number().int().positive() }) });

/** The new item on a board fed by a form, or null for any other board or payload. */
export function createdOnFormBoard(body: unknown): ({ boardId: number; itemId: number } & BriefForm) | null {
  const parsed = CreatedSchema.safeParse(body);
  if (!parsed.success) return null;
  const form = BRIEF_FORMS[parsed.data.event.boardId];
  return form ? { boardId: parsed.data.event.boardId, itemId: parsed.data.event.pulseId, ...form } : null;
}

/** The answers in the form's own order, one per line; long answers get their own paragraph. Empty answers are left out. */
export function briefMarkdown(questions: FormQuestion[], answers: ReadonlyMap<string, string>): string {
  return questions
    .filter((question) => !NOT_ANSWERS.has(question.type))
    .flatMap((question) => {
      const answer = answers.get(question.id)?.trim();
      if (!answer) return [];
      return PARAGRAPH.has(question.type) ? [`**${question.title}**\n\n${answer}`] : [`**${question.title}:** ${answer}`];
    })
    .join("\n\n");
}

/**
 * The brief opens with who sent it, since monday shows the hub's token owner as the update's author. The submitter is
 * the item's creator, the logged-in account monday records and nobody can edit; the typed name is only a "for" note.
 */
export function withSubmitter(markdown: string, submitter: string | undefined, requester: string | undefined): string {
  const by = submitter?.trim();
  if (!by) return markdown;
  const typed = requester?.trim();
  const onBehalf = typed && typed.toLowerCase() !== by.toLowerCase() ? ` for ${typed}` : "";
  return `**Submitted by ${by}${onBehalf} through the request form.**\n\n${markdown}`;
}
