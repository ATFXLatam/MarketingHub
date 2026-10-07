import { describe, expect, it } from "vitest";
import { addBusinessDays, deliveryDays, estimate, type EstimateInput } from "./estimate";

// 2026-10-05 is a Monday.
const complete: EstimateInput = {
  area: "web",
  subtype: "landing",
  landingSubtype: "captacion",
  priority: "normal",
  brief: "x".repeat(200),
  market: "México",
  drive: "https://drive.google.com/folder",
  attachmentCount: 0,
  today: "2026-10-05",
};

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    expect(addBusinessDays("2026-10-09", 1)).toBe("2026-10-12");
  });
});

describe("estimate", () => {
  it("uses the subtype base days for a complete brief and marks it ready", () => {
    const result = estimate(complete);
    expect(result).toMatchObject({ score: 100, tier: "completo", days: 7, date: "2026-10-14", initialStage: "ready" });
  });

  it("adds days and lists what is missing when the brief is thin", () => {
    const result = estimate({ ...complete, brief: "corto", drive: "", market: undefined });
    expect(result.tier).toBe("incompleto");
    expect(result.days).toBe(7 + 4);
    expect(result.missing).toHaveLength(3);
    expect(result.initialStage).toBe("nueva");
  });

  it("shortens turnaround for critical priority but never below one day", () => {
    expect(estimate({ ...complete, priority: "critica" }).days).toBe(4);
    expect(estimate({ ...complete, area: "diseno", subtype: "meta", priority: "critica" }).days).toBe(1);
  });

  it("keeps a blocked request out of ready even when the rest is complete", () => {
    const result = estimate({ ...complete, attachmentCount: 2, blockers: "Faltan logos" });
    expect(result.initialStage).toBe("nueva");
    expect(result.missing).toContain("Resuelve los bloqueadores antes de arrancar");
  });

  it("requires the landing type before counting the piece as chosen", () => {
    expect(estimate({ ...complete, landingSubtype: undefined }).missing).toContain("Elige el tipo de pieza");
  });

  it("flags a requested date earlier than the estimate", () => {
    expect(estimate({ ...complete, dueDate: "2026-10-08" }).tight).toBe(true);
    expect(estimate({ ...complete, dueDate: "2026-10-20" }).tight).toBe(false);
  });
});

describe("deliveryDays", () => {
  it("splits the total into piece type, priority and brief, and keeps a one day floor", () => {
    expect(deliveryDays("web", "landing", "critica", "parcial")).toEqual({ base: 7, priority: -3, brief: 2, days: 6 });
    expect(deliveryDays("diseno", "meta", "critica", "completo")).toEqual({ base: 2, priority: -1, brief: 0, days: 1 });
  });
});
