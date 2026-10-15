import { after, NextResponse } from "next/server";
import { createdOnFormBoard } from "@/lib/form-brief";
import { writeBrief } from "@/lib/monday/brief";
import { safeEqual } from "@/lib/secrets";

/**
 * Subscribed to "When an item is created" on each board fed by a monday form. Copies the form's answers into the new
 * item's description. Shares the intake secret: both webhooks were registered by hand with the same Keychain copy.
 */
export async function POST(request: Request, context: RouteContext<"/api/monday/webhook/[secret]/brief">): Promise<NextResponse> {
  const { secret } = await context.params;
  if (!safeEqual(secret, process.env.MONDAY_INTAKE_SECRET)) {
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

  const created = createdOnFormBoard(body);
  if (created) {
    after(async () => {
      try {
        await writeBrief(created.itemId, created.formToken);
      } catch (error) {
        console.error("form brief description", created, error);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
