import { z } from "zod";
import { ownerPhoto } from "./public-dto";

export const MAX_COMMENT = 2000;

export interface ConversationAuthor {
  id: string;
  name: string;
  photo: string | null;
}

export interface ConversationComment {
  id: string;
  author: ConversationAuthor;
  body: string;
  createdAt: string;
  replies: ConversationComment[];
}

export interface Conversation {
  brief: string | null;
  comments: ConversationComment[];
}

const CreatorSchema = z.object({ id: z.union([z.string(), z.number()]), name: z.string(), photo_thumb_small: z.string().nullable() }).nullable();
const ReplySchema = z.object({ id: z.union([z.string(), z.number()]), text_body: z.string().nullable(), created_at: z.string(), creator: CreatorSchema });
export const RawUpdateSchema = ReplySchema.extend({ replies: z.array(ReplySchema).nullable() });
export type RawUpdate = z.infer<typeof RawUpdateSchema>;
type RawReply = z.infer<typeof ReplySchema>;

// Automations post without a creator.
const UNKNOWN: ConversationAuthor = { id: "monday", name: "monday", photo: null };

function toComment(raw: RawReply): Omit<ConversationComment, "replies"> {
  return {
    id: String(raw.id),
    author: raw.creator ? { id: String(raw.creator.id), name: raw.creator.name, photo: ownerPhoto(raw.creator.photo_thumb_small) } : UNKNOWN,
    body: (raw.text_body ?? "").trim(),
    createdAt: raw.created_at,
  };
}

/** Oldest first, like a conversation reads; monday returns the newest update first. */
export function toConversation(brief: string | null, updates: RawUpdate[]): Conversation {
  const byDate = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
  return {
    brief: brief?.trim() || null,
    comments: updates
      .map((update) => ({ ...toComment(update), replies: (update.replies ?? []).map((reply) => ({ ...toComment(reply), replies: [] })).sort(byDate) }))
      .sort(byDate),
  };
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

/** monday renders update bodies as HTML, so everything typed is escaped and only our own tags remain. */
export function commentHtml(text: string): string {
  return `<p>${escapeHtml(text.trim()).replace(/\r?\n/g, "<br>")}</p>`;
}
