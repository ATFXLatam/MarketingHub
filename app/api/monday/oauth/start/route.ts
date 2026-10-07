import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { safeDestination } from "@/lib/auth/destination";
import { cookieOptions, OAUTH_COOKIE } from "@/lib/auth/session";
import { authorizeUrl, CALLBACK_PATH } from "@/lib/monday/oauth";

const STATE_TTL = 10 * 60;

/** Sends the person to monday with a one-time state, so a forged callback cannot sign them into someone else's account. */
export function GET(request: NextRequest): NextResponse {
  const state = randomBytes(32).toString("base64url");
  const next = safeDestination(request.nextUrl.searchParams.get("redirect_url"), request.nextUrl.origin);
  const response = NextResponse.redirect(authorizeUrl(state, new URL(CALLBACK_PATH, request.nextUrl.origin).href));
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, next }), cookieOptions(STATE_TTL));
  return response;
}
