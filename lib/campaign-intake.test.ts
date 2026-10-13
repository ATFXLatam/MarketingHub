import { describe, expect, it } from "vitest";
import { AFFILIATE_INTAKE, campaignBoardName, intakeStatusChange, parseRange, shiftTimelines, spanOf } from "./campaign-intake";

describe("intakeStatusChange", () => {
  const event = (boardId: number, columnId: string) => ({ event: { boardId, pulseId: "42", columnId } });

  it("names the request when its status changes on the intake board", () => {
    expect(intakeStatusChange(event(AFFILIATE_INTAKE.boardId, AFFILIATE_INTAKE.status))).toBe(42);
  });

  it("ignores other columns and other boards", () => {
    expect(intakeStatusChange(event(AFFILIATE_INTAKE.boardId, "name"))).toBeNull();
    expect(intakeStatusChange(event(1, AFFILIATE_INTAKE.status))).toBeNull();
    expect(intakeStatusChange({ nope: true })).toBeNull();
  });
});

describe("shiftTimelines", () => {
  it("moves every task by the same offset so the first one starts on the given day, keeping empty ones out", () => {
    const tasks = [
      { id: "b", range: parseRange("2026-10-14 - 2026-10-15") },
      { id: "a", range: parseRange("2026-10-13 - 2026-10-13") },
      { id: "c", range: null },
    ];
    expect(shiftTimelines(tasks, "2026-11-02")).toEqual([
      { id: "b", range: { from: "2026-11-03", to: "2026-11-04" } },
      { id: "a", range: { from: "2026-11-02", to: "2026-11-02" } },
    ]);
  });

  it("refuses a start that is not a date", () => {
    expect(() => shiftTimelines([], "tomorrow")).toThrow();
  });
});

describe("campaign naming and span", () => {
  it("prefixes the request title and keeps it under monday's board name limit", () => {
    expect(campaignBoardName("  Affiliate X  -  Gold ")).toBe("Campaign · Affiliate X - Gold");
    expect(campaignBoardName("x".repeat(300))).toHaveLength(100);
  });

  it("spans from the earliest start to the latest end", () => {
    expect(spanOf([{ from: "2026-11-03", to: "2026-11-09" }, { from: "2026-11-02", to: "2026-11-02" }])).toEqual({ from: "2026-11-02", to: "2026-11-09" });
    expect(spanOf([])).toBeNull();
  });
});
