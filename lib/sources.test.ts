import { describe, expect, it } from "vitest";
import { SOURCE_BOARDS } from "./board-config";
import type { PublicOwner, RawItem } from "./public-dto";
import { byPhase, campaignPhase, dueFrom, isCurrent, ownerByFirstName, toSourceTask } from "./sources";

const [team, webinars] = SOURCE_BOARDS;
const person = (id: string, name: string): PublicOwner => ({ id, name, photo: null, title: null, timeZone: null });
const item = (values: RawItem["column_values"], over: Partial<RawItem> = {}): RawItem => ({
  id: "1", name: "Static ads", group: { id: "g" }, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", column_values: values, ...over,
});
const status = (column: string, index: number | null, text: string | null) => ({ id: column, text, index });

describe("toSourceTask", () => {
  it("maps each board's own labels and keeps cancelled work and guideline groups off the hub", () => {
    expect(toSourceTask(team, item([status("status", 16, "Waiting for review")]), new Map())?.stage).toBe("en-curso");
    expect(toSourceTask(team, item([status("status", null, null)]), new Map())?.stage).toBe("nueva");
    expect(toSourceTask(team, item([status("status", 7, "Cancelled")]), new Map())).toBeNull();
    expect(toSourceTask(team, item([status("status", 0, "Working on it")], { group: { id: "new_group70457" } }), new Map())).toBeNull();
  });

  it("assigns a role-planned webinar step to the one person with that first name, and to nobody when it is ambiguous", () => {
    const people = new Map([["1", person("1", "Diego Albuja")], ["2", person("2", "Ane Rojas")], ["3", person("3", "Ane Lopez")]]);
    const step = (role: string) => item([status("project_status", 3, "Lista para empezar"), { id: "text_mm7hvmgs", text: role }, { id: "project_timeline", text: "2026-10-03 - 2026-10-06" }]);
    const diego = toSourceTask(webinars, step("Diego"), people);
    expect(diego?.owners.map((owner) => owner.name)).toEqual(["Diego Albuja"]);
    expect(diego?.dueDate).toBe("2026-10-06");
    expect(toSourceTask(webinars, step("Ane"), people)?.owners).toEqual([]);
    expect(ownerByFirstName("Thomas", people)).toBeNull();
  });
});

describe("isCurrent", () => {
  const now = Date.parse("2026-10-07T00:00:00Z");
  const task = toSourceTask(team, item([status("status", 10, "Need to take action")]), new Map())!;

  it("drops open work untouched and undue for two months, and keeps anything recent or still due", () => {
    expect(isCurrent({ ...task, updatedAt: "2024-01-17T00:00:00Z", dueDate: "2024-01-31" }, now)).toBe(false);
    expect(isCurrent({ ...task, updatedAt: "2024-01-17T00:00:00Z", dueDate: "2026-10-20" }, now)).toBe(true);
    expect(isCurrent({ ...task, updatedAt: "2026-09-29T00:00:00Z", dueDate: null }, now)).toBe(true);
  });
});

describe("campaignPhase", () => {
  it("lets the dates overrule a status nobody moved after the campaign ended", () => {
    expect(campaignPhase({ status: "Live", start: "2026-01-12", end: "2026-01-31" }, "2026-10-07")).toBe("Ended");
    expect(campaignPhase({ status: "Planned", start: "2026-11-01", end: "2026-11-30" }, "2026-10-07")).toBe("Planned");
    expect(campaignPhase({ status: "Live", start: "2026-10-01", end: "2026-10-31" }, "2026-10-07")).toBe("Live");
    expect(campaignPhase({ status: "Planned", start: "2026-10-01", end: null }, "2026-10-07")).toBe("Planned");
  });

  it("lists running campaigns before planned and ended ones", () => {
    const base = { id: "", name: "", region: null, country: null, channel: null, kpi: null, target: null, achieved: null };
    const sorted = byPhase(
      [
        { ...base, id: "ended", status: "Live", start: "2026-01-01", end: "2026-01-31" },
        { ...base, id: "live", status: "Live", start: "2026-10-01", end: "2026-10-31" },
        { ...base, id: "next", status: "Planned", start: "2026-11-01", end: null },
      ],
      "2026-10-07",
    );
    expect(sorted.map((campaign) => campaign.id)).toEqual(["live", "next", "ended"]);
  });
});

describe("dueFrom", () => {
  it("reads a date column and the end of a timeline", () => {
    expect(dueFrom("2026-10-02")).toBe("2026-10-02");
    expect(dueFrom("2026-09-30 - 2026-10-02")).toBe("2026-10-02");
    expect(dueFrom(null)).toBeNull();
  });
});
