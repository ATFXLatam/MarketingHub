import { describe, expect, it } from "vitest";
import type { PublicOwner, PublicTask } from "./public-dto";
import { daysUntil, deliveriesByDate, memberShares, nextDelivery, teamMembers, upcomingDeliveries } from "./team";

const ana: PublicOwner = { id: "1", name: "Ana", photo: null, title: "Diseño", timeZone: "America/Lima" };
const leo: PublicOwner = { id: "2", name: "Leo", photo: null, title: null, timeZone: null };

const task = (over: Partial<PublicTask>): PublicTask => ({
  id: "t", title: "t", source: "requests", owners: [ana], area: "web", stage: "nueva", priority: null, dueDate: null, slaDays: null,
  market: null, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", ...over,
});

describe("teamMembers", () => {
  it("puts whoever has work in progress first and lists that work by due date", () => {
    const members = teamMembers([
      task({ id: "a", owners: [leo], stage: "nueva" }),
      task({ id: "b", stage: "en-curso", dueDate: "2026-10-20" }),
      task({ id: "c", stage: "en-curso", dueDate: "2026-10-09" }),
      task({ id: "d", stage: "hecha" }),
    ]);
    expect(members.map((member) => member.name)).toEqual(["Ana", "Leo"]);
    expect(members[0].current.map((item) => item.id)).toEqual(["c", "b"]);
    expect(members[0]).toMatchObject({ open: 2, done: 1, title: "Diseño" });
    expect(members[0].queue.map((item) => item.id)).toEqual(["c", "b"]);
  });
});

describe("teamMembers areas", () => {
  it("takes a person's areas from the team core, not from the tasks they happened to touch", () => {
    const naomi: PublicOwner = { id: "77121579", name: "Naomi", photo: null, title: null, timeZone: null };
    const members = teamMembers([task({ owners: [naomi], area: "web" }), task({ id: "x", area: "diseno" })]);
    expect(members.find((member) => member.name === "Naomi")?.areas).toEqual(["video"]);
    expect(members.find((member) => member.name === "Ana")?.areas).toEqual([]);
  });
});

describe("teamMembers roster", () => {
  it("lists roster people with no work after the busy ones", () => {
    const members = teamMembers([task({ stage: "en-curso" })], [leo, ana]);
    expect(members.map((member) => [member.name, member.open])).toEqual([["Ana", 1], ["Leo", 0]]);
  });
});

describe("deliveries", () => {
  it("orders open dated work by date and counts calendar days from today", () => {
    const list = upcomingDeliveries([
      task({ id: "late", dueDate: "2026-10-01" }),
      task({ id: "soon", dueDate: "2026-10-08" }),
      task({ id: "done", dueDate: "2026-10-02", stage: "hecha" }),
      task({ id: "none" }),
    ]);
    expect(list.map((item) => item.id)).toEqual(["late", "soon"]);
    expect(daysUntil("2026-10-08", "2026-10-06")).toBe(2);
    expect(daysUntil("2026-10-01", "2026-10-06")).toBe(-5);
  });
});

describe("nextDelivery", () => {
  it("skips overdue work, even a mistyped year, and picks the first date from today on", () => {
    const next = nextDelivery([task({ id: "typo", dueDate: "2000-11-11" }), task({ id: "soon", dueDate: "2026-10-09" }), task({ id: "today", dueDate: "2026-10-06" })], "2026-10-06");
    expect(next?.id).toBe("today");
  });
});

describe("memberShares", () => {
  it("reads late work from the due date and treats an empty queue as on time", () => {
    const [ana] = teamMembers([
      task({ id: "late", stage: "ready", dueDate: "2026-10-01" }),
      task({ id: "ok", stage: "en-curso", dueDate: "2026-10-20" }),
      task({ id: "done", stage: "hecha" }),
      task({ id: "undated", stage: "nueva" }),
    ]);
    expect(memberShares(ana, "2026-10-06")).toEqual({ entregadas: 25, alDia: 67, enCurso: 33 });
    expect(memberShares({ ...ana, open: 0, done: 0, queue: [], current: [] }, "2026-10-06")).toEqual({ entregadas: 0, alDia: 100, enCurso: 0 });
  });
});

describe("deliveriesByDate", () => {
  it("puts work due today with what is ahead, and leaves delivered work out", () => {
    const { overdue, upcoming } = deliveriesByDate(
      [task({ id: "today", dueDate: "2026-10-06" }), task({ id: "late", dueDate: "2026-10-01" }), task({ id: "next", dueDate: "2026-10-09" }), task({ id: "done", stage: "hecha", dueDate: "2026-10-02" })],
      "2026-10-06",
    );
    expect(overdue.map((item) => item.id)).toEqual(["late"]);
    expect(upcoming.map((item) => item.id)).toEqual(["today", "next"]);
  });
});
