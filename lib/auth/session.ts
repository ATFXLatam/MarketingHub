import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "hub_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
/** How long a permission check stands before the proxy asks monday again; access removed there ends here within this window. */
export const RECHECK_MS = 10 * 60 * 1000;

export interface Session {
  userId: string;
  name: string;
  email: string;
  photo: string | null;
  /** The person's own monday token: every read or write about tasks runs with their permissions, never ours. */
  token: string;
  /** Their monday user can open the requests board, so the hub may show it. */
  board: boolean;
  /** A full member seat; viewers and guests cannot request work. */
  canRequest: boolean;
  checkedAt: number;
  expiresAt: number;
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/** The 32 byte key from MONDAY_TOKEN_KEY (base64); a missing or short key fails loudly instead of sealing with a weak one. */
export function sessionKey(raw: string | undefined): Buffer {
  const key = Buffer.from(raw ?? "", "base64");
  if (key.length !== 32) throw new Error("MONDAY_TOKEN_KEY must be a 32 byte base64 key");
  return key;
}

/** Encrypts and authenticates the session, so the cookie can neither be read nor edited in the browser. */
export function sealSession(session: Session, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
}

/** The session, or null when the cookie was tampered with, sealed with another key, or has expired. */
export function openSession(value: string | undefined, key: Buffer, now: number): Session | null {
  if (!value) return null;
  const [iv, tag, body] = value.split(".").map((part) => Buffer.from(part ?? "", "base64url"));
  if (!iv || !tag || !body || iv.length !== IV_BYTES || tag.length !== 16) return null;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const session = JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8")) as Session;
    return session.expiresAt > now ? session : null;
  } catch {
    return null;
  }
}

export const OAUTH_COOKIE = "hub_oauth";

/** httpOnly so scripts never see the token; lax so the redirect back from monday still carries the state cookie. */
export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

/** A fresh session from what monday just confirmed, keeping the token and the original expiry. */
export function withAccess(base: Omit<Session, "board" | "canRequest" | "checkedAt">, access: { board: boolean; canRequest: boolean }, now: number): Session {
  return { ...base, board: access.board, canRequest: access.canRequest, checkedAt: now };
}
