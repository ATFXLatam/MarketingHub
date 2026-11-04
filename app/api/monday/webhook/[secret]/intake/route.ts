import { after, NextResponse } from "next/server";
import { intakeStatusChange } from "@/lib/campaign-intake";
import { spawnCampaign } from "@/lib/monday/campaign";
import { spawnRetail } from "@/lib/monday/retail";
import { spawnWebinar } from "@/lib/monday/webinar";
import { retailStatusChange } from "@/lib/retail-intake";
import { safeEqual } from "@/lib/secrets";
import { webinarStatusChange } from "@/lib/webinar-intake";

// Copying the template and waiting for monday to finish it runs after the response, inside this budget.
export const maxDuration = 300;

/**
 * Subscribed to "When a column changes" on the Status of "Solicitudes Afiliados", "Webinars LATAM · Calendario" and
 * "Campañas Retail · Solicitudes". An Accepted or Aprobado item gets its template copied into a board of its own. The
 * payload is unsigned and only names the item; the item is re-read before anything is created.
 */
export async function POST(request: Request, context: RouteContext<"/api/monday/webhook/[secret]/intake">): Promise<NextResponse> {
  const { secret } = await context.params;
  // Its own secret: the shared one is Sensitive in Vercel and nobody kept a copy, so this webhook could not be
  // subscribed without rotating it under the webhooks already running.
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

  const origin = new URL(request.url).origin;
  const requestId = intakeStatusChange(body);
  if (requestId) {
    after(async () => {
      try {
        await spawnCampaign(requestId, origin);
      } catch (error) {
        console.error("affiliate campaign board", requestId, error);
      }
    });
  }
  const webinarId = webinarStatusChange(body);
  if (webinarId) {
    after(async () => {
      try {
        await spawnWebinar(webinarId, origin);
      } catch (error) {
        console.error("webinar board", webinarId, error);
      }
    });
  }
  const retailId = retailStatusChange(body);
  if (retailId) {
    after(async () => {
      try {
        await spawnRetail(retailId, origin);
      } catch (error) {
        console.error("retail campaign board", retailId, error);
      }
    });
  }
  return NextResponse.json({ ok: true });
}
