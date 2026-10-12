import { after, NextResponse } from "next/server";
import { statusChange } from "@/lib/dependencies";
import { unblockDependents } from "@/lib/monday/unblock";
import { safeEqual } from "@/lib/secrets";

/**
 * Subscribed per project board to "When a column changes" on Status. monday has no dependency recipe for multi-level
 * boards, so this replaces it: when a task is done, the tasks that only waited on it become Lista para empezar.
 * The payload is unsigned and only names the item; the board is re-read before anything is written.
 */
export async function POST(request: Request, context: RouteContext<"/api/monday/webhook/[secret]/dependencies">): Promise<NextResponse> {
  const { secret } = await context.params;
  if (!safeEqual(secret, process.env.MONDAY_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body && typeof body === "object" && "challenge" in body) {
    return NextResponse.json({ challenge: (body as { challenge: unknown }).challenge });
  }

  const change = statusChange(body);
  if (change) {
    // monday retries a webhook that takes too long; answer first and do the reads and writes afterwards.
    after(async () => {
      try {
        await unblockDependents(change.boardId, change.itemId);
      } catch (error) {
        console.error("monday dependency unblock", change, error);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
