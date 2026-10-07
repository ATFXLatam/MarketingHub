import { describe, expect, it } from "vitest";
import type { PublicEvent, PublicTask } from "./public-dto";
import { dailyCounts, requestBreakdowns, shiftDay } from "./team-metrics";

const task = (over: Partial<PublicTask>): PublicTask => ({
  id: "t", title: "t", owners: [], area: "web", stage: "nueva", priority: null, dueDate: null, slaDays: null,
  market: null, createdAt: "2026-10-05T18:00:00Z", updatedAt: "2026-10-05T18:00:00Z", ...over,
});
const event = (over: Partial<PublicEvent>): PublicEvent => ({ id: "e", taskId: "t", taskTitle: "t", stage: "ready", at: "2026-10-06T18:00:00Z", ...over });

describe("dailyCounts", () => {
  it("buckets by Mexico City day, so a request sent at 8 pm there counts that day and not the next UTC one", () => {
    const rows = dailyCounts(
      [task({ createdAt: "2026-10-06T02:00:00Z" }), task({ createdAt: "2026-09-01T00:00:00Z" })],
      [event({}), event({ id: "d", stage: "hecha" })],
      "2026-10-06",
      3,
    );
    expect(rows.map((row) => row.date)).toEqual(["2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(rows[1].values).toEqual({ nuevas: 1, movimientos: 0, entregadas: 0 });
    expect(rows[2].values).toEqual({ nuevas: 0, movimientos: 2, entregadas: 1 });
  });

  it("crosses month ends when shifting days", () => {
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("requestBreakdowns", () => {
  it("counts only the range and names what is missing", () => {
    const { areas, markets } = requestBreakdowns(
      [task({ market: "Perú" }), task({ area: null }), task({ area: "video", createdAt: "2026-08-01T18:00:00Z" })],
      "2026-10-06",
      7,
    );
    expect(areas).toEqual([{ name: "No area", value: 1 }, { name: "Web", value: 1 }]);
    expect(markets).toEqual([{ name: "No market", value: 1 }, { name: "Perú", value: 1 }]);
  });
});
