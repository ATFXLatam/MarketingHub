import "server-only";
import { z } from "zod";
import { briefMarkdown } from "../form-brief";
import { mondayQuery } from "./client";

const BriefSchema = z.object({
  form: z.object({ questions: z.array(z.object({ id: z.string(), title: z.string(), type: z.string(), visible: z.boolean() })) }).nullable(),
  items: z.array(z.object({ column_values: z.array(z.object({ id: z.string(), text: z.string().nullable() })) })),
});

/** Posts the form's answers as the item's pinned first update. Reads both from the API: the webhook payload is unsigned. */
export async function writeBrief(itemId: number, formToken: string): Promise<void> {
  const { form, items } = BriefSchema.parse(
    await mondayQuery(`query ($token: String!, $item: [ID!]) { form(formToken: $token) { questions { id title type visible } } items(ids: $item) { column_values { id text } } }`, {
      token: formToken,
      item: [itemId],
    }),
  );
  const item = items[0];
  if (!form || !item) return;
  const markdown = briefMarkdown(form.questions.filter((question) => question.visible), new Map(item.column_values.map((value) => [value.id, value.text ?? ""])));
  if (!markdown) return;

  // set_item_description_content answers a bare 500 on this account (tested on 2026-07 from the hub and by hand), so
  // the brief goes in an update pinned to the top: it stays first however many comments follow.
  const { create_update } = UpdateSchema.parse(
    await mondayQuery(`mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, {
      item: itemId,
      body: markdownToUpdateHtml(markdown),
    }),
  );
  await mondayQuery(`mutation ($update: ID!, $item: ID) { pin_to_top(id: $update, item_id: $item) { id } }`, { update: create_update.id, item: itemId });
}

const UpdateSchema = z.object({ create_update: z.object({ id: z.string() }) });

// Updates take HTML, not markdown: bold labels and paragraphs are all the brief uses.
function markdownToUpdateHtml(markdown: string): string {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return markdown
    .split("\n\n")
    .map((block) => `<p>${escape(block).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
    .join("");
}
