"use server";

import { updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { currentSession } from "@/lib/auth/current";
import { estimate, type Estimate } from "@/lib/estimate";
import { createRateLimiter } from "@/lib/intake/rate-limit";
import { blobStoreHost, ownBlobHref } from "@/lib/intake/blob-url";
import { RequestSchema } from "@/lib/intake/schema";
import { todayIn } from "@/lib/dates";
import { MondayError } from "@/lib/monday/client";
import { BOARD_TAG, getAreaPeople } from "@/lib/monday/read";
import { createRequestItem, ownersFor } from "@/lib/monday/write";
import { notifyTeams } from "@/lib/teams";

export type SubmitResult =
  | { success: true; data: { itemId: string; estimate: Estimate } }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// HACK: per-instance limiter, a burst brake and not a hard cap. Move to a shared counter (KV) when monday's daily API
// budget shows pressure or someone scripts submissions.
const isRateLimited = createRateLimiter(10, 60 * 60 * 1000);
const KeySchema = z.uuid();

export async function submitRequest(input: unknown, idempotencyKey: string): Promise<SubmitResult> {
  const user = await currentSession();
  if (!user?.canRequest) {
    return { success: false, error: "Your account does not have access to this form." };
  }
  if (isRateLimited(user.userId)) {
    return { success: false, error: "You sent several requests in a row. Wait a few minutes and try again." };
  }
  if (!KeySchema.safeParse(idempotencyKey).success) return { success: false, error: "Reload the page and try again." };

  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]));
    return { success: false, error: "Check the highlighted fields.", fieldErrors };
  }

  // Only files our upload route signed may reach monday, where the team clicks them.
  const storeHost = blobStoreHost(process.env.BLOB_READ_WRITE_TOKEN);
  const attachments = parsed.data.attachments.map((file) => ({ ...file, url: ownBlobHref(file.url, storeHost) }));
  if (attachments.some((file) => file.url === null)) {
    return { success: false, error: "One of the attachments is not valid. Remove it and upload it again." };
  }
  const request = { ...parsed.data, attachments: attachments as { url: string; name: string }[] };
  const today = todayIn();
  if (request.dueDate < today) {
    return { success: false, error: "Check the highlighted fields.", fieldErrors: { dueDate: "That date has already passed" } };
  }

  const result = estimate({
    ...request,
    landingSubtype: request.area === "web" ? request.landingSubtype : undefined,
    attachmentCount: request.attachments.length,
    today,
  });
  // Name and email come from monday through the session, never from the form.
  const requester = { name: user.name, email: user.email };

  try {
    // Board members write as themselves; monday cannot let someone who does not see the board add to it.
    const itemId = await createRequestItem(request, requester, result, idempotencyKey, user.board ? user.token : undefined);
    updateTag(BOARD_TAG);
    // After the response, so the requester never waits on Teams.
    after(async () => {
      const people = await getAreaPeople(ownersFor(request.area).map(String)).catch(() => new Map());
      const owners = ownersFor(request.area).map((id) => people.get(String(id))?.name ?? `monday user ${id}`);
      await notifyTeams({ itemId, request, requester: user.name, estimate: result, owners });
    });
    return { success: true, data: { itemId, estimate: result } };
  } catch (error) {
    console.error("could not create the request in monday", { user: user.userId, error });
    const wait = error instanceof MondayError && error.retryInSeconds ? ` in ${error.retryInSeconds} seconds` : "";
    return { success: false, error: `monday did not respond. Your request was not lost: send it again${wait}.` };
  }
}
