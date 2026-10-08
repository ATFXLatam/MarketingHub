import { AREA_LABEL, PRIORITY_LABEL, SOURCE_LABEL, STAGE_LABEL } from "./board-config";
import type { PublicEvent, PublicTask } from "./public-dto";
import { daysUntil, deliveriesByDate, type TeamMember } from "./team";

const RECENT_DAYS = 30;

const names = (task: PublicTask) => (task.owners.length ? task.owners.map((owner) => owner.name).join(", ") : "no owner");

function line(task: PublicTask, today: string): string {
  const due = task.dueDate ? `due ${task.dueDate} (${daysUntil(task.dueDate, today) < 0 ? `${-daysUntil(task.dueDate, today)} days overdue` : `in ${daysUntil(task.dueDate, today)} days`})` : "no due date";
  return `- [${task.id}] ${task.title} | ${task.area ? AREA_LABEL[task.area] : SOURCE_LABEL[task.source]} | ${STAGE_LABEL[task.stage]} | ${task.priority ? `${PRIORITY_LABEL[task.priority]} priority` : "no priority"} | ${due} | ${names(task)}`;
}

/**
 * The board as plain text for the model: only what the hub already shows, built on the server from the cached snapshot,
 * so a question can never make the model see more than the person asking can see on the page.
 */
export function boardContext(tasks: PublicTask[], activity: PublicEvent[], members: TeamMember[], today: string): string {
  const open = tasks.filter((task) => task.stage !== "hecha");
  const { overdue, upcoming } = deliveriesByDate(tasks, today);
  const since = Date.parse(`${today}T00:00:00Z`) - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const delivered = activity.filter((event) => event.stage === "hecha" && Date.parse(event.at) >= since).length;
  const people = members.map(
    (member) => `- ${member.name}${member.title ? ` (${member.title})` : ""}: ${member.current.length} in progress, ${member.open} open, ${member.done} done`,
  );
  return [
    `Today is ${today}. Team: ATFX LATAM marketing. Areas: ${Object.values(AREA_LABEL).join(", ")}.`,
    `Open requests: ${open.length}. Overdue: ${overdue.length}. Upcoming with a date: ${upcoming.length}. Delivered in the last ${RECENT_DAYS} days: ${delivered}.`,
    "",
    "People and their load:",
    ...people,
    "",
    `Open work across the ${Object.values(SOURCE_LABEL).join(", ")} boards (id | title | area or board | stage | priority | due | owners):`,
    ...open.map((task) => line(task, today)),
  ].join("\n");
}

/**
 * Request titles are written by anyone who can submit, and the model reads them; a title can talk it into adding a link.
 * The board needs no links in answers, so every markdown or angle-bracket link is reduced to its plain text.
 */
export function withoutLinks(answer: string): string {
  return answer.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<((?:https?|mailto):[^>\s]*)>/gi, "$1");
}

/** A display name set in monday goes into the prompt; control characters could otherwise open a new instruction line. */
export function promptName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 80);
}
