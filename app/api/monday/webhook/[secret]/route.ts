import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { BOARD_TAG } from "@/lib/monday/read";
import { safeEqual } from "@/lib/secrets";

/**
 * monday calls this on every board change. Webhooks created with a personal token carry no signature, so the payload
 * is treated as a signal and never as data: a valid secret in the URL only expires the cache, and the next visit reads
 * the board from the API.
 */
export async function POST(request: Request, context: RouteContext<"/api/monday/webhook/[secret]">): Promise<NextResponse> {
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

  // Registration handshake: monday only saves the webhook if the challenge comes back unchanged.
  if (body && typeof body === "object" && "challenge" in body) {
    return NextResponse.json({ challenge: (body as { challenge: unknown }).challenge });
  }

  // A short stale window instead of expire: 0, so a burst of status changes (or a looping caller) collapses into one
  // background refetch per minute rather than one monday read per change.
  revalidateTag(BOARD_TAG, { expire: 60 });
  return NextResponse.json({ ok: true });
}
