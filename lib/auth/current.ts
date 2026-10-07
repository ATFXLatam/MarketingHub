import "server-only";
import { cookies } from "next/headers";
import { openSession, SESSION_COOKIE, sessionKey, type Session } from "./session";

/** The signed-in person for server components and actions; the proxy has already refreshed their monday permissions. */
export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  return openSession(jar.get(SESSION_COOKIE)?.value, sessionKey(process.env.MONDAY_TOKEN_KEY), Date.now());
}
