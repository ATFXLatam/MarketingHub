import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { allowedEmail, isAllowedEmail } = await import("./access");

const user = (status: string | null) => ({ primaryEmailAddress: { emailAddress: "ana@atfx.com", verification: { status } } });

afterEach(() => vi.unstubAllEnvs());

describe("access", () => {
  it("rejects an allowed domain until the address is verified", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "atfx.com");
    expect(allowedEmail(user("unverified"))).toBeNull();
    expect(allowedEmail(user("verified"))).toBe("ana@atfx.com");
  });

  it("keeps a deployment without a domain list closed, preview included", () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(isAllowedEmail("ana@atfx.com")).toBe(false);
  });
});
