import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// POST only, so a link or image on another site cannot sign people out.
export function POST(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL("/sign-in", request.nextUrl.origin), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
