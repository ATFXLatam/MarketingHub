import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openSession, sealSession, type Session } from "./session";

const key = randomBytes(32);
const session: Session = { userId: "1", name: "Ana", email: "a@atfx.com", photo: null, token: "secret-token", board: false, canRequest: true, checkedAt: 0, expiresAt: 2_000 };

describe("session cookie", () => {
  it("hides the token and rejects an edited, foreign or expired cookie", () => {
    const sealed = sealSession(session, key);
    expect(sealed).not.toContain("secret-token");
    expect(openSession(sealed, key, 1_000)).toEqual(session);
    const [iv, tag, body] = sealed.split(".");
    const flipped = Buffer.from(body, "base64url");
    flipped[0] ^= 1;
    expect(openSession([iv, tag, flipped.toString("base64url")].join("."), key, 1_000)).toBeNull();
    expect(openSession(sealed, randomBytes(32), 1_000)).toBeNull();
    expect(openSession(sealed, key, 3_000)).toBeNull();
  });
});
