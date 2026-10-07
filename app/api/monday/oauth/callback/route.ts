import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { accessFor, type SignInError } from "@/lib/access";
import { safeDestination } from "@/lib/auth/destination";
import { cookieOptions, OAUTH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE, sealSession, sessionKey, withAccess } from "@/lib/auth/session";
import { safeEqual } from "@/lib/secrets";
import { CALLBACK_PATH, exchangeCode, hubAccountId, identify } from "@/lib/monday/oauth";

const PendingSchema = z.object({ state: z.string().min(32), next: z.string() });

function denied(request: NextRequest, reason: SignInError): NextResponse {
  const url = new URL("/sign-in", request.nextUrl.origin);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  let pending: z.infer<typeof PendingSchema> | null = null;
  try {
    pending = PendingSchema.parse(JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? ""));
  } catch {
    pending = null;
  }
  const code = params.get("code");
  if (!pending || !code || !safeEqual(params.get("state") ?? "", pending.state)) {
    return denied(request, params.get("error") === "access_denied" ? "cancelada" : "expirada");
  }

  try {
    const token = await exchangeCode(code, new URL(CALLBACK_PATH, request.nextUrl.origin).href);
    const [identity, account] = await Promise.all([identify(token), hubAccountId()]);
    const access = accessFor(identity, account);
    if (!access.allowed) return denied(request, access.reason);

    const now = Date.now();
    const session = withAccess(
      { userId: identity.id, name: identity.name, email: identity.email, photo: identity.photo, token, expiresAt: now + SESSION_MAX_AGE * 1000 },
      access,
      now,
    );
    // Without board access only the request form exists for this person.
    const next = access.board ? safeDestination(pending.next, request.nextUrl.origin) : "/request";
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
    response.cookies.set(SESSION_COOKIE, sealSession(session, sessionKey(process.env.MONDAY_TOKEN_KEY)), cookieOptions(SESSION_MAX_AGE));
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch (error) {
    console.error("monday oauth callback", error);
    return denied(request, "monday");
  }
}
