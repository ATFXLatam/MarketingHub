import { describe, expect, it } from "vitest";
import { COLUMNS } from "../board-config";
import { estimate } from "../estimate";
import { RequestSchema } from "../intake/schema";
import { briefWithDetails, buildColumnValues } from "./columns";

const base = {
  title: "Landing webinar oro",
  dueDate: "2026-10-30",
  brief: "Landing de captación para el webinar de oro de octubre.",
  priority: "alta",
  market: "México",
  drive: "",
  attachments: [],
};

describe("buildColumnValues", () => {
  it("writes labels by id, the area subtype and the estimate", () => {
    const request = RequestSchema.parse({ ...base, area: "web", subtype: "landing", landingSubtype: "evento" });
    const result = estimate({ ...request, attachmentCount: 0, today: "2026-10-05" });
    const values = buildColumnValues(request, { name: "Ana", email: "ana@atfxgm.com" }, result, [42]);

    expect(values[COLUMNS.area]).toEqual({ index: 7 });
    expect(values[COLUMNS.priority]).toEqual({ index: 19 });
    expect(values[COLUMNS.webType]).toEqual({ ids: [1] });
    expect(values[COLUMNS.landingSubtype]).toEqual({ ids: [2] });
    expect(values[COLUMNS.dueDate]).toEqual({ date: "2026-10-30" });
    expect(values[COLUMNS.slaDays]).toBe(String(result.days));
    expect(values[COLUMNS.owner]).toEqual({ personsAndTeams: [{ id: 42, kind: "person" }] });
    expect(values).not.toHaveProperty(COLUMNS.drive);
  });

  it("only writes the subtype column of the chosen area", () => {
    const request = RequestSchema.parse({ ...base, area: "video", subtype: "reel" });
    const values = buildColumnValues(request, { name: "Ana", email: "ana@atfxgm.com" }, estimate({ ...request, attachmentCount: 0, today: "2026-10-05" }), []);
    expect(values[COLUMNS.videoType]).toEqual({ ids: [1] });
    expect(values).not.toHaveProperty(COLUMNS.webType);
    expect(values).not.toHaveProperty(COLUMNS.owner);
  });

  it("writes the new areas to the labels and piece columns created for them in monday", () => {
    const request = RequestSchema.parse({ ...base, area: "data", subtype: "dashboard" });
    const values = buildColumnValues(request, { name: "Ana", email: "ana@atfxgm.com" }, estimate({ ...request, attachmentCount: 0, today: "2026-10-05" }), []);
    expect(values[COLUMNS.area]).toEqual({ index: 160 });
    expect(values[COLUMNS.dataType]).toEqual({ ids: [2] });
  });
});

describe("RequestSchema", () => {
  it("requires the landing type for a new landing", () => {
    expect(RequestSchema.safeParse({ ...base, area: "web", subtype: "landing" }).success).toBe(false);
  });

  it("rejects a subtype from another area", () => {
    expect(RequestSchema.safeParse({ ...base, area: "video", subtype: "landing" }).success).toBe(false);
  });
});

describe("briefWithDetails", () => {
  it("appends the answered requirements as labelled lines and reads the copy answer in words", () => {
    expect(briefWithDetails({ brief: "Promo de oro", details: { objective: "Generate leads", copyReady: "no", cta: " " } })).toBe(
      "Promo de oro\n\nRequirements\nObjective: Generate leads\nCopy or script ready: Not yet",
    );
    expect(briefWithDetails({ brief: "Solo brief", details: {} })).toBe("Solo brief");
    expect(briefWithDetails({ brief: "B", details: { venue: "Sala 1\nPresupuesto: 0" } })).toBe("B\n\nRequirements\nVenue: Sala 1 Presupuesto: 0");
  });
});
