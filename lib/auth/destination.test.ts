import { describe, expect, it } from "vitest";
import { safeDestination } from "./destination";

describe("safeDestination", () => {
  it("keeps same-origin paths, including the absolute URL Clerk sends back", () => {
    expect(safeDestination("/p/abc?x=1")).toBe("/p/abc?x=1");
    expect(safeDestination("https://hub.example/solicitar", "https://hub.example")).toBe("/solicitar");
  });

  it("falls back for other origins and protocol-relative tricks", () => {
    expect(safeDestination("https://evil.example/phish", "https://hub.example")).toBe("/solicitar");
    expect(safeDestination("//evil.example/phish", "https://hub.example")).toBe("/solicitar");
    expect(safeDestination(null)).toBe("/solicitar");
  });

  it.each(["/.//evil.com", "/..//evil.com", "/%2e//evil.com", "/a/..//evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"])(
    "never returns a protocol-relative or foreign target for %s",
    (input) => {
      expect(safeDestination(input, "https://hub.example")).toBe("/solicitar");
    },
  );
});
