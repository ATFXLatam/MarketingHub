import { after, NextResponse } from "next/server";
import { intakeStatusChange } from "@/lib/campaign-intake";
import { spawnCampaign } from "@/lib/monday/campaign";
import { safeEqual } from "@/lib/secrets";

// Copying the template and waiting for monday to finish it runs after the response, inside this budget.
export const maxDuration = 120;

/**
 * Subscribed on "Solicitudes Afiliados" to "When a column changes" on its Status. When a request becomes Accepted the
 * hub copies the campaign template into a board of its own. The payload is unsigned and only names the item; the
 * request is re-read before anything is created.
 */
export async function POST(request: Request, context: RouteContext<"/api/monday/webhook/[secret]/intake">): Promise<NextResponse> {
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

  const requestId = intakeStatusChange(body);
  if (requestId) {
    const origin = new URL(request.url).origin;
    after(async () => {
      try {
        await spawnCampaign(requestId, origin);
      } catch (error) {
        console.error("affiliate campaign board", requestId, error);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
