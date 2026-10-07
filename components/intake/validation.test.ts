import { describe, expect, it } from "vitest";
import { stepErrors, type Draft } from "./validation";

const draft: Draft = { title: "Landing oro", area: "web", subtype: "landing", landingSubtype: "", priority: "normal", market: "LATAM", brief: "x".repeat(30), drive: "", blockers: "", details: {} };

describe("stepErrors", () => {
  it("stops the brief step until a new landing has its type", () => {
    expect(stepErrors("brief", draft, { pendingUploads: false })).toEqual({ landingSubtype: "Choose the landing type." });
    expect(stepErrors("brief", { ...draft, landingSubtype: "evento" }, { pendingUploads: false })).toEqual({});
  });

  it("holds the material step while uploads are running and rejects non-https Drive links", () => {
    const errors = stepErrors("material", { ...draft, drive: "drive.google.com/x" }, { pendingUploads: true });
    expect(Object.keys(errors).sort()).toEqual(["attachments", "drive"]);
  });

  it("lets the requirements step pass empty but rejects a malformed URL or duration", () => {
    expect(stepErrors("requisitos", draft, { pendingUploads: false })).toEqual({});
    const errors = stepErrors("requisitos", { ...draft, details: { url: "atfx.com", duration: "30s" } }, { pendingUploads: false });
    expect(Object.keys(errors).sort()).toEqual(["duration", "url"]);
  });
});
