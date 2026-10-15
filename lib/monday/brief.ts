import "server-only";
import { z } from "zod";
import { briefMarkdown } from "../form-brief";
import { mondayQuery } from "./client";

const BriefSchema = z.object({
  form: z.object({ questions: z.array(z.object({ id: z.string(), title: z.string(), type: z.string() })) }).nullable(),
  items: z.array(z.object({ column_values: z.array(z.object({ id: z.string(), text: z.string().nullable() })) })),
});

/** Writes the form's answers as the item's description. Reads both from the API: the webhook payload is unsigned. */
export async function writeBrief(itemId: number, formToken: string): Promise<void> {
  const { form, items } = BriefSchema.parse(
    await mondayQuery(`query ($token: String!, $item: [ID!]) { form(formToken: $token) { questions { id title type } } items(ids: $item) { column_values { id text } } }`, {
      token: formToken,
      item: [itemId],
    }),
  );
  const item = items[0];
  if (!form || !item) return;
  const markdown = briefMarkdown(form.questions, new Map(item.column_values.map((value) => [value.id, value.text ?? ""])));
  if (!markdown) return;

  const result = await mondayQuery<{ set_item_description_content: { success: boolean; error: string | null } }>(
    `mutation ($item: ID!, $markdown: String!) { set_item_description_content(item_id: $item, markdown: $markdown) { success error } }`,
    { item: itemId, markdown },
  ).catch((error: unknown) => ({ set_item_description_content: { success: false, error: String(error) } }));
  if (result.set_item_description_content.success) return;

  // Descriptions are a 2026-04 API feature; if monday refuses one, the brief still lands on the item as its first update.
  console.error("item description refused, posting the brief as an update", itemId, result.set_item_description_content.error);
  await mondayQuery(`mutation ($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`, {
    item: itemId,
    body: markdownToUpdateHtml(markdown),
  });
}

// Updates take HTML, not markdown: bold labels and paragraphs are all the brief uses.
function markdownToUpdateHtml(markdown: string): string {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return markdown
    .split("\n\n")
    .map((block) => `<p>${escape(block).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`)
    .join("");
}
