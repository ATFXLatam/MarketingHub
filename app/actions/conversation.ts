"use server";

import { z } from "zod";
import { currentSession } from "@/lib/auth/current";
import { MAX_COMMENT, type Conversation } from "@/lib/conversation";
import { createRateLimiter } from "@/lib/intake/rate-limit";
import { MondayError } from "@/lib/monday/client";
import { postUpdate, readConversation } from "@/lib/monday/conversation";

export interface Viewer { id: string; name: string; photo: string | null }
export type ConversationResult = { success: true; data: { conversation: Conversation; viewer: Viewer } } | { success: false; error: string; signIn?: boolean };
export type PostResult = { success: true; data: { id: string } } | { success: false; error: string };

// HACK: per-instance limiters, a burst brake and not a hard cap. Shared counter (KV) when someone scripts comments.
const isRateLimited = createRateLimiter(30, 60 * 60 * 1000);
// Each read is a monday query; a loop of drawer opens must not drain the person's monday budget.
const isReadLimited = createRateLimiter(240, 60 * 60 * 1000);
const ItemId = z.string().regex(/^\d{1,20}$/);
const PostSchema = z.object({
  itemId: ItemId,
  parentId: ItemId.nullable(),
  body: z.string().trim().min(1, "Write something before sending.").max(MAX_COMMENT, `${MAX_COMMENT} characters at most.`),
  idempotencyKey: z.uuid(),
});

// Tasks open only to people whose own monday user sees the board; their token then decides what monday returns.
async function boardMember() {
  const session = await currentSession();
  return session?.board ? session : null;
}

const failure = (error: unknown) =>
  error instanceof MondayError && error.retryInSeconds ? "monday is busy. Try again in a minute." : "We could not reach monday. Try again.";

export async function getConversation(itemId: string): Promise<ConversationResult> {
  const session = await boardMember();
  if (!session) return { success: false, error: "Sign in with your monday user to see the brief and comment.", signIn: true };
  if (isReadLimited(session.userId)) return { success: false, error: "You opened many requests in a row. Wait a few minutes." };
  if (!ItemId.safeParse(itemId).success) return { success: false, error: "This request does not exist." };
  try {
    const conversation = await readConversation(itemId, session.token);
    return conversation
      ? { success: true, data: { conversation, viewer: { id: session.userId, name: session.name, photo: session.photo } } }
      : { success: false, error: "This request does not exist." };
  } catch (error) {
    console.error("getConversation", itemId, error);
    return { success: false, error: failure(error) };
  }
}

export async function postComment(input: unknown): Promise<PostResult> {
  const session = await boardMember();
  if (!session) return { success: false, error: "Sign in with your monday user to comment." };
  if (isRateLimited(session.userId)) return { success: false, error: "You sent many comments in a row. Wait a few minutes." };
  const parsed = PostSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the comment." };
  const { itemId, parentId, body, idempotencyKey } = parsed.data;
  try {
    // Re-read so a forged id cannot post on another board or reply under another item's update.
    const conversation = await readConversation(itemId, session.token);
    if (!conversation) return { success: false, error: "This request does not exist." };
    if (parentId && !conversation.comments.some((comment) => comment.id === parentId)) return { success: false, error: "That comment no longer exists." };
    return { success: true, data: { id: await postUpdate(itemId, body, parentId, session.token, idempotencyKey) } };
  } catch (error) {
    console.error("postComment", itemId, error);
    return { success: false, error: failure(error) };
  }
}
