import { describe, expect, it } from "vitest";
import { AREAS } from "./board-config";
import { briefQuality } from "./estimate";
import { requirementsFor } from "./requirements";

const base = { brief: "x".repeat(200), subtype: "reel", market: "LATAM", drive: "https://drive.google.com/x", attachmentCount: 0 };

describe("requirementsFor", () => {
  it("weighs every area to exactly 100 so the score reads as a percentage", () => {
    AREAS.forEach((area) => expect(requirementsFor(area).reduce((sum, item) => sum + item.weight, 0)).toBe(100));
  });
});

describe("briefQuality by area", () => {
  it("asks video for its own details and counts a copy that is not ready as missing", () => {
    const partial = briefQuality({ ...base, area: "video", details: { objective: "Generar leads", audience: "Traders nuevos", format: "Vertical 9:16", copyReady: "no" } });
    expect(partial.gaps.map((gap) => gap.field)).toEqual(["copyReady", "duration"]);
    expect(partial.score).toBe(85);

    const full = briefQuality({ ...base, area: "video", details: { objective: "Generar leads", audience: "Traders nuevos", format: "Vertical 9:16", copyReady: "si", duration: "30" } });
    expect(full).toMatchObject({ score: 100, tier: "completo", gaps: [] });
  });

  it("drops a well written brief to partial when the area details are missing", () => {
    const result = briefQuality({ ...base, area: "eventos", subtype: "interno", details: { objective: "Comunicación interna", audience: "Equipo" } });
    expect(result.score).toBe(75);
    expect(result.tier).toBe("parcial");
    expect(result.gaps.every((gap) => gap.step === "requisitos")).toBe(true);
  });
});
