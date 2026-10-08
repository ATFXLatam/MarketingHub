import { AREA_LABEL, BOARD_ID, PRIORITY_LABEL } from "./board-config";
import { formatDay } from "./dates";
import type { Estimate } from "./estimate";
import type { IntakeRequest } from "./intake/schema";

const TIMEOUT_MS = 8000;
const MAX_TEXT = 200;

export interface NewRequestNotice {
  itemId: string;
  request: Pick<IntakeRequest, "title" | "area" | "priority" | "market" | "dueDate">;
  requester: string;
  estimate: Pick<Estimate, "date" | "tight">;
  owners: string[];
}

/**
 * Teams renders markdown inside card text, and titles and names are typed by people; a bracket or an angle bracket
 * could otherwise turn a title into a link the whole marketing group sees as the hub's own.
 */
export function cardText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/[[\]()<>*_~`#|\\]/g, "").trim().slice(0, MAX_TEXT);
}

/** The message body the Power Automate "Teams webhook" trigger expects: one Adaptive Card attachment. */
export function newRequestCard({ itemId, request, requester, estimate, owners }: NewRequestNotice): object {
  const facts = [
    { title: "Area", value: AREA_LABEL[request.area] },
    { title: "Requested by", value: cardText(requester) },
    { title: "Assigned to", value: owners.length ? owners.map(cardText).join(", ") : "Unassigned" },
    { title: "Priority", value: PRIORITY_LABEL[request.priority] },
    { title: "Market", value: cardText(request.market) },
    { title: "Due", value: formatDay(request.dueDate) },
    { title: "Estimated delivery", value: `${formatDay(estimate.date)}${estimate.tight ? " (after the requested date)" : ""}` },
  ];
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: "New marketing request", size: "Small", isSubtle: true, wrap: true },
            { type: "TextBlock", text: cardText(request.title), size: "Large", weight: "Bolder", wrap: true },
            { type: "FactSet", facts },
          ],
          actions: [{ type: "Action.OpenUrl", title: "Open in monday", url: `https://atfx.monday.com/boards/${BOARD_ID}/pulses/${itemId}` }],
        },
      },
    ],
  };
}

/** Posts to the marketing group. A Teams outage must never fail a request monday already holds, so this only logs. */
export async function notifyTeams(notice: NewRequestNotice, url = process.env.TEAMS_WEBHOOK_URL): Promise<void> {
  if (!url) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRequestCard(notice)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) console.error("teams notification", { itemId: notice.itemId, status: response.status });
  } catch (error) {
    console.error("teams notification", { itemId: notice.itemId, error });
  }
}
