import { TEAM_AREAS, TEAM_LINKEDIN } from "./board-config";
import type { PublicEvent, PublicOwner, PublicTask } from "./public-dto";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TeamMember extends PublicOwner {
  /** What the member has in progress right now, most urgent first. */
  current: PublicTask[];
  /** Everything assigned that is not finished yet. */
  open: number;
  done: number;
  /** Request areas the member answers for, from the team core; empty for people outside it. */
  areas: NonNullable<PublicTask["area"]>[];
  /** Open work by due date, so the profile can list what comes next. */
  queue: PublicTask[];
  /** Public LinkedIn profile from the team core, so the team shows who built the work. */
  linkedin: string | null;
}

const byDue = (a: PublicTask, b: PublicTask) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");

/** Everyone assigned to a visible task plus the roster, busiest first, so the people carrying the most work lead the page. */
export function teamMembers(tasks: PublicTask[], roster: PublicOwner[] = []): TeamMember[] {
  const people = new Map<string, PublicOwner>(roster.map((person) => [person.id, person]));
  tasks.forEach((task) => task.owners.forEach((owner) => people.set(owner.id, owner)));
  return [...people.values()]
    .map((owner) => {
      const mine = tasks.filter((task) => task.owners.some((assigned) => assigned.id === owner.id));
      return {
        ...owner,
        current: mine.filter((task) => task.stage === "en-curso").sort(byDue),
        open: mine.filter((task) => task.stage !== "hecha").length,
        done: mine.filter((task) => task.stage === "hecha").length,
        areas: [...(TEAM_AREAS.get(owner.id) ?? [])],
        queue: mine.filter((task) => task.stage !== "hecha").sort(byDue),
        linkedin: TEAM_LINKEDIN.get(owner.id) ?? null,
      };
    })
    .sort((a, b) => b.current.length - a.current.length || b.open - a.open || a.name.localeCompare(b.name));
}

/**
 * One person's slice of the board, so every widget answers for the same person. Activity follows the tasks it belongs
 * to, which keeps the feed and the trend lines from counting someone else's moves. No person means the whole team.
 */
export function scopeToPerson(
  tasks: PublicTask[],
  activity: PublicEvent[],
  personId: string | null,
): { tasks: PublicTask[]; activity: PublicEvent[] } {
  if (!personId) return { tasks, activity };
  const mine = tasks.filter((task) => task.owners.some((owner) => owner.id === personId));
  const ids = new Set(mine.map((task) => task.id));
  return { tasks: mine, activity: activity.filter((event) => ids.has(event.taskId)) };
}

/** Whole calendar days from today to a YYYY-MM-DD date; negative when it already passed. */
export function daysUntil(isoDate: string, today: string): number {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** Open work with a date, soonest first; overdue work stays at the top until it is done. */
export function upcomingDeliveries(tasks: PublicTask[]): PublicTask[] {
  return tasks.filter((task) => task.dueDate && task.stage !== "hecha").sort(byDue);
}

/** Open dated work split at today: what already slipped, oldest first, and what is still ahead, soonest first. */
export function deliveriesByDate(tasks: PublicTask[], today: string): { overdue: PublicTask[]; upcoming: PublicTask[] } {
  const dated = upcomingDeliveries(tasks);
  return { overdue: dated.filter((task) => task.dueDate! < today), upcoming: dated.filter((task) => task.dueDate! >= today) };
}

/** The next delivery still ahead; overdue work is shown on its own card, not as a "0 days" countdown. */
export function nextDelivery(tasks: PublicTask[], today: string): PublicTask | undefined {
  return deliveriesByDate(tasks, today).upcoming[0];
}

/** A member's shares, in percent: what they finished, what is still on time, and what is moving now. */
export function memberShares(member: TeamMember, today: string): { entregadas: number; alDia: number; enCurso: number } {
  const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
  const late = member.queue.filter((task) => task.dueDate !== null && task.dueDate < today).length;
  return {
    entregadas: percent(member.done, member.done + member.open),
    alDia: member.open ? percent(member.open - late, member.open) : 100,
    enCurso: percent(member.current.length, member.open),
  };
}
