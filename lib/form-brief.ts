import { z } from "zod";
import { AFFILIATE_INTAKE } from "./campaign-intake";
import { BOARD_ID } from "./board-config";

/**
 * Boards fed by a monday form, with that form's token. Every item they get carries the form's answers in a pinned
 * update, so whoever opens the task reads the whole brief in one place instead of across twenty columns.
 */
export const BRIEF_FORMS: Readonly<Record<number, string>> = {
  [BOARD_ID]: "1db69245acb26fea6719f4a2aa52ad7f",
  [AFFILIATE_INTAKE.boardId]: "49abbb29b7ce43c91ad31b39357ef9b0",
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
export function createdOnFormBoard(body: unknown): { boardId: number; itemId: number; formToken: string } | null {
  const parsed = CreatedSchema.safeParse(body);
  if (!parsed.success) return null;
  const formToken = BRIEF_FORMS[parsed.data.event.boardId];
  return formToken ? { boardId: parsed.data.event.boardId, itemId: parsed.data.event.pulseId, formToken } : null;
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
