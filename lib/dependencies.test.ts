import { describe, expect, it } from "vitest";
import { statusChange, unblockedBy, type StatusLabel, type Task } from "./dependencies";

const LABELS: StatusLabel[] = [
  { id: 0, label: "Working on it", done: false },
  { id: 1, label: "Done", done: true },
  { id: 3, label: "Lista para empezar", done: false },
  { id: 4, label: "Bloqueada", done: false },
];
const task = (id: string, status: number | null, dependsOn: string[] = [], leaf = true): Task => ({ id, status, dependsOn, leaf });

describe("unblockedBy", () => {
  it("releases a blocked task once the task it waits on is done", () => {
    expect(unblockedBy("a", [task("a", 1), task("b", 4, ["a"])], LABELS)).toEqual(["b"]);
  });

  it("keeps a task with two dependencies blocked until both are done", () => {
    const tasks = [task("banners", 1), task("lps", 0), task("review", 4, ["banners", "lps"])];
    expect(unblockedBy("banners", tasks, LABELS)).toEqual([]);
    expect(unblockedBy("lps", [...tasks.slice(0, 1), task("lps", 1), tasks[2]], LABELS)).toEqual(["review"]);
  });

  it("leaves alone a dependent someone already started", () => {
    expect(unblockedBy("a", [task("a", 1), task("b", 0, ["a"])], LABELS)).toEqual([]);
  });

  it("does nothing when the triggering task is not actually done", () => {
    expect(unblockedBy("a", [task("a", 3), task("b", 4, ["a"])], LABELS)).toEqual([]);
  });

  it("skips parent rows, whose status is a rollup monday will not let us write", () => {
    expect(unblockedBy("a", [task("a", 1), task("b", 4, ["a"], false)], LABELS)).toEqual([]);
  });
});

describe("statusChange", () => {
  it("reads only the ids of a status change", () => {
    expect(statusChange({ event: { boardId: 1, pulseId: "2", columnId: "project_status", value: { label: { text: "Done" } } } })).toEqual({
      boardId: 1,
      itemId: 2,
    });
  });

  it("ignores changes to other columns and malformed payloads", () => {
    expect(statusChange({ event: { boardId: 1, pulseId: 2, columnId: "project_timeline" } })).toBeNull();
    expect(statusChange({ challenge: "x" })).toBeNull();
  });
});
