import { NextResponse, type NextRequest } from "next/server";
import { accessFor, type SignInError } from "@/lib/access";
import { cookieOptions, openSession, RECHECK_MS, SESSION_COOKIE, sealSession, sessionKey, withAccess, type Session } from "@/lib/auth/session";
import { hubAccountId, identify } from "@/lib/monday/oauth";
import { safeEqual } from "@/lib/secrets";

// The board link and monday's webhook carry their own secret in the URL; sign-in and its OAuth hops are open by nature.
const OPEN = [/^\/api\/monday\/webhook\//, /^\/api\/monday\/oauth\//, /^\/sign-in(\/|$)/];
// All a person without the board in monday may reach: the form, its Server Action and the upload signer.
const REQUEST_ONLY = [/^\/solicitar$/, /^\/api\/blob-upload$/];

function toSignIn(request: NextRequest, error?: SignInError): NextResponse {
  const url = new URL("/sign-in", request.nextUrl.origin);
  url.searchParams.set("redirect_url", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (error) url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

/** Asks monday again whether the person may still be here; removing their seat or board access ends their hub access too. */
async function recheck(session: Session, now: number): Promise<Session | SignInError> {
  try {
    const [identity, account] = await Promise.all([identify(session.token), hubAccountId()]);
    const access = accessFor(identity, account);
    return access.allowed ? withAccess({ ...session, name: identity.name, photo: identity.photo }, access, now) : access.reason;
  } catch (error) {
    // Fails closed: a revoked token and a monday outage look alike from here, and neither should keep the door open.
    console.error("monday access recheck", error);
    return "verificacion";
  }
}

export default async function proxy(request: NextRequest): Promise<NextResponse | undefined> {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/p/")) {
    // Checked here as well as in the page: the page streams, so its notFound() would already answer 200.
    let token = "";
    try {
      token = decodeURIComponent(pathname.split("/")[2] ?? "");
    } catch {
      // A malformed escape is just a wrong token.
    }
    return safeEqual(token, process.env.PUBLIC_BOARD_TOKEN) ? undefined : new NextResponse(null, { status: 404 });
  }
  if (OPEN.some((pattern) => pattern.test(pathname))) return undefined;

  const key = sessionKey(process.env.MONDAY_TOKEN_KEY);
  const now = Date.now();
  let session = openSession(request.cookies.get(SESSION_COOKIE)?.value, key, now);
  if (!session) return toSignIn(request);

  const stale = now - session.checkedAt > RECHECK_MS;
  if (stale) {
    const result = await recheck(session, now);
    if (typeof result === "string") return toSignIn(request, result);
    session = result;
  }

  const sealed = stale ? sealSession(session, key) : null;
  // The page in this same request must read the refreshed access, not the cookie the browser sent.
  if (sealed) request.cookies.set(SESSION_COOKIE, sealed);
  const allowed = session.board || REQUEST_ONLY.some((pattern) => pattern.test(pathname));
  const response = allowed ? NextResponse.next({ request: { headers: request.headers } }) : NextResponse.redirect(new URL("/solicitar", request.nextUrl.origin));
  if (sealed) response.cookies.set(SESSION_COOKIE, sealed, cookieOptions(Math.floor((session.expiresAt - now) / 1000)));
  return response;
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|otf|ico)).*)", "/(api|trpc)(.*)"],
};
