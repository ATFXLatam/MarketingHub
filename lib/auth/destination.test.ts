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
});
