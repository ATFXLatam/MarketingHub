import { describe, expect, it } from "vitest";
import { addBusinessDays } from "./estimate";
import { planWebinar, WEBINAR_INTAKE, webinarStatusChange } from "./webinar-intake";

describe("addBusinessDays", () => {
  it("counts back over weekends too", () => {
    expect(addBusinessDays("2026-12-07", -1)).toBe("2026-12-04");
    expect(addBusinessDays("2026-12-04", 1)).toBe("2026-12-07");
  });
});

describe("planWebinar", () => {
  const steps = [
    { id: "brief", start: -21, end: -20 },
    { id: "webinar", start: 0, end: 0 },
    { id: "report", start: 7, end: 13 },
    { id: "undated", start: null, end: null },
  ];

  it("keeps an asked date with enough lead time and dates each step in business days around it", () => {
    const plan = planWebinar(steps, "2026-12-31", "2026-11-02");
    expect(plan).toEqual({
      webinar: "2026-12-31",
      moved: false,
      steps: [
        { id: "brief", range: { from: "2026-12-02", to: "2026-12-03" } },
        { id: "webinar", range: { from: "2026-12-31", to: "2026-12-31" } },
        { id: "report", range: { from: "2027-01-11", to: "2027-01-19" } },
      ],
    });
  });

  it("moves a webinar asked too soon to the first date that keeps the full lead time from today", () => {
    const plan = planWebinar(steps, "2026-11-10", "2026-11-02");
    expect(plan.moved).toBe(true);
    expect(plan.webinar).toBe("2026-12-01");
    expect(plan.steps[0].range.from).toBe("2026-11-02");
  });

  it("starts counting on Monday when approved on a weekend", () => {
    expect(planWebinar(steps, "2026-11-10", "2026-10-31").steps[0].range.from).toBe("2026-11-02");
  });
});

describe("webinarStatusChange", () => {
  it("names the webinar only when its status changes on the calendar board", () => {
    expect(webinarStatusChange({ event: { boardId: WEBINAR_INTAKE.boardId, pulseId: "9", columnId: WEBINAR_INTAKE.status } })).toBe(9);
    expect(webinarStatusChange({ event: { boardId: WEBINAR_INTAKE.boardId, pulseId: "9", columnId: "name" } })).toBeNull();
  });
});
