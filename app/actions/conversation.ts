"use server";

import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { allowedEmail } from "@/lib/access";
import { MAX_COMMENT, type Conversation } from "@/lib/conversation";
import { createRateLimiter } from "@/lib/intake/rate-limit";
import { MondayError } from "@/lib/monday/client";
import { postUpdate, readConversation } from "@/lib/monday/conversation";

export interface Viewer { id: string; name: string; photo: string | null }
export type ConversationResult = { success: true; data: { conversation: Conversation; viewer: Viewer } } | { success: false; error: string; signIn?: boolean };
export type PostResult = { success: true; data: { id: string } } | { success: false; error: string };

// HACK: per-instance limiters, a burst brake and not a hard cap. Shared counter (KV) when someone scripts comments.
const isRateLimited = createRateLimiter(30, 60 * 60 * 1000);
// Every read is a monday query on the one shared token, so a loop of drawer opens must not drain it for everyone.
const isReadLimited = createRateLimiter(240, 60 * 60 * 1000);
const ItemId = z.string().regex(/^\d{1,20}$/);
const PostSchema = z.object({
  itemId: ItemId,
  parentId: ItemId.nullable(),
  body: z.string().trim().min(1, "Escribe algo antes de enviar.").max(MAX_COMMENT, `Máximo ${MAX_COMMENT} caracteres.`),
  idempotencyKey: z.uuid(),
});

// The board is public, the brief and the conversation are not: they carry requester details and internal notes.
async function member() {
  const user = await currentUser();
  const email = allowedEmail(user);
  return user && email ? { id: user.id, name: user.fullName?.trim() || email, photo: user.imageUrl || null } : null;
}

const failure = (error: unknown) =>
  error instanceof MondayError && error.retryInSeconds ? "monday está ocupado. Intenta en un minuto." : "No pudimos hablar con monday. Intenta de nuevo.";

export async function getConversation(itemId: string): Promise<ConversationResult> {
  const viewer = await member();
  if (!viewer) return { success: false, error: "Inicia sesión con tu correo de ATFX para ver el brief y comentar.", signIn: true };
  if (isReadLimited(viewer.id)) return { success: false, error: "Abriste muchas solicitudes seguidas. Espera unos minutos." };
  if (!ItemId.safeParse(itemId).success) return { success: false, error: "Esta solicitud no existe." };
  try {
    const conversation = await readConversation(itemId);
    return conversation ? { success: true, data: { conversation, viewer } } : { success: false, error: "Esta solicitud no existe." };
  } catch (error) {
    console.error("getConversation", itemId, error);
    return { success: false, error: failure(error) };
  }
}

export async function postComment(input: unknown): Promise<PostResult> {
  const user = await member();
  if (!user) return { success: false, error: "Inicia sesión con tu correo de ATFX para comentar." };
  if (isRateLimited(user.id)) return { success: false, error: "Enviaste muchos comentarios seguidos. Espera unos minutos." };
  const parsed = PostSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Revisa el comentario." };
  const { itemId, parentId, body, idempotencyKey } = parsed.data;
  try {
    // Re-read so a forged id cannot post on another board or reply under another item's update.
    const conversation = await readConversation(itemId);
    if (!conversation) return { success: false, error: "Esta solicitud no existe." };
    if (parentId && !conversation.comments.some((comment) => comment.id === parentId)) return { success: false, error: "Ese comentario ya no existe." };
    return { success: true, data: { id: await postUpdate(itemId, user.name, body, parentId, idempotencyKey) } };
  } catch (error) {
    console.error("postComment", itemId, error);
    return { success: false, error: failure(error) };
  }
}
