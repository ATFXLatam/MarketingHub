import { describe, expect, it } from "vitest";
import { planRetail, RETAIL_INTAKE, retailBoardName, retailStatusChange } from "./retail-intake";

describe("planRetail", () => {
  const steps = [
    { id: "form", start: 0, end: 0 },
    { id: "copy", start: 4, end: 5 },
    { id: "undated", start: null, end: null },
  ];

  it("dates each step in business days from the approval day, so a step crossing a weekend ends after it", () => {
    expect(planRetail(steps, "2026-11-05")).toEqual([
      { id: "form", range: { from: "2026-11-05", to: "2026-11-05" } },
      { id: "copy", range: { from: "2026-11-11", to: "2026-11-12" } },
    ]);
  });

  it("starts on Monday when approved on a weekend", () => {
    expect(planRetail(steps, "2026-11-07")[0].range).toEqual({ from: "2026-11-09", to: "2026-11-09" });
  });
});

describe("retail intake", () => {
  it("names the request only when its status changes on the retail requests board", () => {
    expect(retailStatusChange({ event: { boardId: RETAIL_INTAKE.boardId, pulseId: "7", columnId: RETAIL_INTAKE.status } })).toBe(7);
    expect(retailStatusChange({ event: { boardId: RETAIL_INTAKE.boardId, pulseId: "7", columnId: "name" } })).toBeNull();
  });

  it("prefixes the campaign name and keeps it under monday's board name limit", () => {
    expect(retailBoardName(" Leads  oro ")).toBe("Campaña Retail · Leads oro");
    expect(retailBoardName("x".repeat(300))).toHaveLength(100);
  });
});
