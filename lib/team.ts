import type { PublicOwner, PublicTask } from "./public-dto";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TeamMember extends PublicOwner {
  /** What the member has in progress right now, most urgent first. */
  current: PublicTask[];
  /** Everything assigned that is not finished yet. */
  open: number;
  done: number;
}

const byDue = (a: PublicTask, b: PublicTask) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");

/** Everyone assigned to a visible task, busiest first, so the people carrying the most work lead the page. */
export function teamMembers(tasks: PublicTask[]): TeamMember[] {
  const people = new Map<string, PublicOwner>();
  tasks.forEach((task) => task.owners.forEach((owner) => people.set(owner.id, owner)));
  return [...people.values()]
    .map((owner) => {
      const mine = tasks.filter((task) => task.owners.some((assigned) => assigned.id === owner.id));
      return {
        ...owner,
        current: mine.filter((task) => task.stage === "en-curso").sort(byDue),
        open: mine.filter((task) => task.stage !== "hecha").length,
        done: mine.filter((task) => task.stage === "hecha").length,
      };
    })
    .sort((a, b) => b.current.length - a.current.length || b.open - a.open || a.name.localeCompare(b.name));
}

/** Whole calendar days from today to a YYYY-MM-DD date; negative when it already passed. */
export function daysUntil(isoDate: string, today: string): number {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** Open work with a date, soonest first; overdue work stays at the top until it is done. */
export function upcomingDeliveries(tasks: PublicTask[]): PublicTask[] {
  return tasks.filter((task) => task.dueDate && task.stage !== "hecha").sort(byDue);
}

/** The next delivery still ahead; overdue work is shown on its own card, not as a "0 days" countdown. */
export function nextDelivery(tasks: PublicTask[], today: string): PublicTask | undefined {
  return upcomingDeliveries(tasks).find((task) => task.dueDate! >= today);
}
