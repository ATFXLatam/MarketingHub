"use server";

import { currentUser } from "@clerk/nextjs/server";
import { updateTag } from "next/cache";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/access";
import { estimate, type Estimate } from "@/lib/estimate";
import { createRateLimiter } from "@/lib/intake/rate-limit";
import { blobStoreHost, ownBlobHref } from "@/lib/intake/blob-url";
import { RequestSchema } from "@/lib/intake/schema";
import { todayIn } from "@/lib/dates";
import { MondayError } from "@/lib/monday/client";
import { BOARD_TAG } from "@/lib/monday/read";
import { createRequestItem } from "@/lib/monday/write";

export type SubmitResult =
  | { success: true; data: { itemId: string; estimate: Estimate } }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// HACK: per-instance limiter, a burst brake and not a hard cap. Move to a shared counter (KV) when monday's daily API
// budget shows pressure or someone scripts submissions.
const isRateLimited = createRateLimiter(10, 60 * 60 * 1000);
const KeySchema = z.uuid();

export async function submitRequest(input: unknown, idempotencyKey: string, website: string): Promise<SubmitResult> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!user || !email || !isAllowedEmail(email)) {
    return { success: false, error: "Tu cuenta no tiene acceso a este formulario." };
  }
  // Bots fill every field; answering success keeps them from learning which one gave them away.
  if (website) return { success: true, data: { itemId: "", estimate: emptyEstimate() } };
  if (isRateLimited(user.id)) {
    return { success: false, error: "Enviaste varias solicitudes seguidas. Espera unos minutos y vuelve a intentar." };
  }
  if (!KeySchema.safeParse(idempotencyKey).success) return { success: false, error: "Recarga la página e intenta de nuevo." };

  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]));
    return { success: false, error: "Revisa los campos marcados.", fieldErrors };
  }

  // Only files our upload route signed may reach monday, where the team clicks them.
  const storeHost = blobStoreHost(process.env.BLOB_READ_WRITE_TOKEN);
  const attachments = parsed.data.attachments.map((file) => ({ ...file, url: ownBlobHref(file.url, storeHost) }));
  if (attachments.some((file) => file.url === null)) {
    return { success: false, error: "Uno de los adjuntos no es válido. Quítalo y vuelve a subirlo." };
  }
  const request = { ...parsed.data, attachments: attachments as { url: string; name: string }[] };
  const today = todayIn();
  if (request.dueDate < today) {
    return { success: false, error: "Revisa los campos marcados.", fieldErrors: { dueDate: "La fecha ya pasó" } };
  }

  const result = estimate({
    ...request,
    blockers: request.area === "web" ? request.blockers : undefined,
    landingSubtype: request.area === "web" ? request.landingSubtype : undefined,
    attachmentCount: request.attachments.length,
    today,
  });
  const requester = { name: user.fullName?.trim() || email, email };

  try {
    const itemId = await createRequestItem(request, requester, result, idempotencyKey);
    updateTag(BOARD_TAG);
    return { success: true, data: { itemId, estimate: result } };
  } catch (error) {
    console.error("no se pudo crear la solicitud en monday", { user: user.id, error });
    const wait = error instanceof MondayError && error.retryInSeconds ? ` en ${error.retryInSeconds} segundos` : "";
    return { success: false, error: `monday no respondió. Tu solicitud no se perdió: vuelve a enviarla${wait}.` };
  }
}

function emptyEstimate(): Estimate {
  return { score: 0, tier: "incompleto", missing: [], days: 0, date: "", tight: false, initialStage: "nueva" };
}
