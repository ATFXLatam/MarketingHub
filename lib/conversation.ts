import { z } from "zod";
import { ownerPhoto } from "./public-dto";

/** Comments are signed with this marker because the hub posts through one monday token, not as each person. */
export const HUB_SIGNATURE = "desde el hub";
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

const UNKNOWN: ConversationAuthor = { id: "monday", name: "monday", photo: null };
const SIGNED = new RegExp(`^\\s*(.{1,80}?) · ${HUB_SIGNATURE}\\s*`);

/**
 * monday names the token owner as the author of every hub comment; the signature line names the real one. Only trusted
 * on the hub's own posts, so nobody can sign as someone else by typing the marker in monday.
 */
function toComment(raw: RawReply, hubUserId: string | null): Omit<ConversationComment, "replies"> {
  const creator = raw.creator ? { id: String(raw.creator.id), name: raw.creator.name, photo: ownerPhoto(raw.creator.photo_thumb_small) } : UNKNOWN;
  const text = (raw.text_body ?? "").trim();
  const signed = creator.id === hubUserId ? SIGNED.exec(text) : null;
  return {
    id: String(raw.id),
    author: signed ? { id: `hub:${signed[1]}`, name: signed[1], photo: null } : creator,
    body: signed ? text.slice(signed[0].length) : text,
    createdAt: raw.created_at,
  };
}

/** Oldest first, like a conversation reads; monday returns the newest update first. */
export function toConversation(brief: string | null, updates: RawUpdate[], hubUserId: string | null): Conversation {
  const byDate = (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt);
  return {
    brief: brief?.trim() || null,
    comments: updates
      .map((update) => ({ ...toComment(update, hubUserId), replies: (update.replies ?? []).map((reply) => ({ ...toComment(reply, hubUserId), replies: [] })).sort(byDate) }))
      .sort(byDate),
  };
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

/** monday renders update bodies as HTML, so everything typed is escaped and only our own tags remain. */
export function commentHtml(author: string, text: string): string {
  const name = escapeHtml(author.replace(/\s+/g, " ").trim().slice(0, 80));
  return `<p><strong>${name}</strong> · ${HUB_SIGNATURE}</p><p>${escapeHtml(text.trim()).replace(/\r?\n/g, "<br>")}</p>`;
}
