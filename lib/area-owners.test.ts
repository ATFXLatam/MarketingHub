import { describe, expect, it } from "vitest";
import { areaOwners } from "./area-owners";
import type { PublicOwner, PublicTask } from "./public-dto";

const ana: PublicOwner = { id: "1", name: "Ana", photo: null, title: null, timeZone: null };
const leo: PublicOwner = { id: "2", name: "Leo", photo: null, title: null, timeZone: null };
const sol: PublicOwner = { id: "3", name: "Sol", photo: null, title: null, timeZone: null };
const task = (area: PublicTask["area"], owners: PublicOwner[]): PublicTask => ({
  id: Math.random().toString(), title: "t", owners, area, stage: "nueva", priority: null, dueDate: null, slaDays: null,
  market: null, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
});

describe("areaOwners", () => {
  it("prefers the configured owner and falls back to whoever took most of the area", () => {
    const tasks = [task("web", [ana]), task("web", [leo]), task("web", [leo]), task("video", [ana])];
    const owners = areaOwners(tasks, { video: ["3"] }, new Map([["3", sol]]));
    expect(owners.web).toEqual([{ ...leo, assigned: false }]);
    expect(owners.video).toEqual([{ ...sol, assigned: true }]);
    expect(owners.eventos).toEqual([]);
  });
});
