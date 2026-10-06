import { describe, expect, it } from "vitest";
import { stepErrors, type Draft } from "./validation";

const draft: Draft = { title: "Landing oro", area: "web", subtype: "landing", landingSubtype: "", priority: "normal", market: "LATAM", brief: "x".repeat(30), drive: "", blockers: "" };

describe("stepErrors", () => {
  it("stops the brief step until a new landing has its type", () => {
    expect(stepErrors(1, draft, { pendingUploads: false })).toEqual({ landingSubtype: "Elige el tipo de landing." });
    expect(stepErrors(1, { ...draft, landingSubtype: "evento" }, { pendingUploads: false })).toEqual({});
  });

  it("holds the material step while uploads are running and rejects non-https Drive links", () => {
    const errors = stepErrors(3, { ...draft, drive: "drive.google.com/x" }, { pendingUploads: true });
    expect(Object.keys(errors).sort()).toEqual(["attachments", "drive"]);
  });
});
