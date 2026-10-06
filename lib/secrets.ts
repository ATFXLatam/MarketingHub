import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison; hashing first gives both sides the same length, so the length itself leaks nothing. */
export function safeEqual(received: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}
