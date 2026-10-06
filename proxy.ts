import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/secrets";

// The board link and monday's webhook carry their own secret in the URL; everything else needs a Clerk session.
const isBoard = createRouteMatcher(["/p/(.*)"]);
const isWebhook = createRouteMatcher(["/api/monday/webhook/(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isBoard(request)) {
    // Checked here as well as in the page: the page streams, so its notFound() would already answer 200.
    let token = "";
    try {
      token = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
    } catch {
      // A malformed escape is just a wrong token.
    }
    if (!safeEqual(token, process.env.PUBLIC_BOARD_TOKEN)) return new NextResponse(null, { status: 404 });
    return;
  }
  if (isWebhook(request)) return;
  // Redirect instead of auth.protect(): protect() answers 404 to a signed-out visitor, which reads as a broken site.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|otf|ico)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
