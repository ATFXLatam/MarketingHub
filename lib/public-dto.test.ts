import { describe, expect, it } from "vitest";
import { COLUMNS } from "./board-config";
import { canonicalMarket, ownerIds, ownerPhoto, toPublicEvent, toPublicTask, visibleTasks, type RawItem } from "./public-dto";

const item: RawItem = {
  id: "1",
  name: "Landing webinar oro",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
  column_values: [
    { id: COLUMNS.status, text: "En curso", index: 4 },
    { id: COLUMNS.area, text: "Web", index: 7 },
    { id: COLUMNS.priority, text: "Alta", index: 19 },
    { id: COLUMNS.dueDate, text: "2026-10-20" },
    { id: COLUMNS.slaDays, text: "7" },
    { id: COLUMNS.market, text: "México" },
    { id: COLUMNS.owner, text: "Ana, Diseño", persons_and_teams: [{ id: 11, kind: "person" }, { id: 5, kind: "team" }] },
    // Private columns, in case a wider query ever returns them.
    { id: COLUMNS.requesterEmail, text: "persona@atfxgm.com" },
    { id: COLUMNS.brief, text: "brief interno" },
  ],
};

describe("toPublicTask", () => {
  it("returns only whitelisted fields, never requester data or the brief", () => {
    const task = toPublicTask(item);
    expect(Object.keys(task).sort()).toEqual(
      ["area", "createdAt", "dueDate", "id", "market", "owners", "priority", "slaDays", "source", "stage", "title", "updatedAt"].sort(),
    );
    expect(JSON.stringify(task)).not.toMatch(/persona@|brief interno/);
    expect(task).toMatchObject({ stage: "en-curso", area: "web", priority: "alta", slaDays: 7 });
  });

  it("falls back to the label text, then to nueva, when the status id is unknown", () => {
    const withText = { ...item, column_values: [{ id: COLUMNS.status, text: "Hecha", index: 99 }] };
    const blank = { ...item, column_values: [{ id: COLUMNS.status, text: null, index: null }] };
    expect(toPublicTask(withText).stage).toBe("hecha");
    expect(toPublicTask(blank).stage).toBe("nueva");
  });
});

describe("owners", () => {
  it("maps assigned people to name and photo, skipping teams and anyone the lookup did not return", () => {
    const people = new Map([["11", { id: "11", name: "Ana", photo: null, title: "Diseño", timeZone: "America/Lima" }]]);
    expect(ownerIds([item])).toEqual(["11"]);
    expect(toPublicTask(item, people).owners).toEqual([{ id: "11", name: "Ana", photo: null, title: "Diseño", timeZone: "America/Lima" }]);
    expect(toPublicTask(item).owners).toEqual([]);
  });
});

describe("canonicalMarket", () => {
  it("merges the spellings of one market so the breakdown counts it once", () => {
    expect(canonicalMarket("MEXICO")).toBe("México");
    expect(canonicalMarket("Mexico / Argentina")).toBe(canonicalMarket("México / Argentina"));
    expect(canonicalMarket("Mexico / Argentina")).toBe("México / Argentina");
    expect(canonicalMarket("Monterrey")).toBe("Monterrey");
    expect(canonicalMarket("  ")).toBeNull();
  });
});

describe("ownerPhoto", () => {
  it("keeps uploaded monday photos and drops anything next/image would refuse", () => {
    expect(ownerPhoto("https://files.monday.com/use1/photos/1/thumb_small/1.png?1")).toBe("https://files.monday.com/use1/photos/1/thumb_small/1.png?1");
    expect(ownerPhoto("https://cdn1.monday.com/dapulse_default_photo.png")).toBeNull();
    expect(ownerPhoto("https://files.monday.com/use1/photos/60519988/thumb/60519988-user_photo_initials_2024_05_24_17_48_05.png?1")).toBeNull();
    expect(ownerPhoto("http://files.monday.com/use1/photos/1.png")).toBeNull();
    expect(ownerPhoto(null)).toBeNull();
  });
});

describe("visibleTasks", () => {
  it("hides work finished more than 30 days ago and keeps everything open", () => {
    const now = Date.parse("2026-12-01T00:00:00Z");
    const old = { ...toPublicTask(item), id: "old", stage: "hecha" as const, updatedAt: "2026-10-01T00:00:00Z" };
    const recent = { ...old, id: "recent", updatedAt: "2026-11-20T00:00:00Z" };
    const open = { ...old, id: "open", stage: "nueva" as const };
    expect(visibleTasks([old, recent, open], now).map((task) => task.id)).toEqual(["recent", "open"]);
  });
});

describe("toPublicEvent", () => {
  const log = (data: unknown, event = "update_column_value") => ({
    id: "a1",
    event,
    data: JSON.stringify(data),
    created_at: "17596800000000000",
  });

  it("keeps status changes with title and stage only", () => {
    const event = toPublicEvent(
      log({ pulse_id: 1, pulse_name: "Reel promo", column_id: COLUMNS.status, value: { label: { index: 1, text: "Hecha" } }, user_id: 5 }),
    );
    expect(event).toEqual({ id: "a1", taskId: "1", taskTitle: "Reel promo", stage: "hecha", at: "2025-10-05T16:00:00.000Z" });
  });

  it("drops other columns, other events and malformed data", () => {
    expect(toPublicEvent(log({ pulse_id: 1, pulse_name: "x", column_id: COLUMNS.brief, value: { label: {} } }))).toBeNull();
    expect(toPublicEvent(log({}, "create_pulse"))).toBeNull();
    expect(toPublicEvent({ id: "a2", event: "update_column_value", data: "{", created_at: "0" })).toBeNull();
  });
});
