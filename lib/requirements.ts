import type { Area } from "./board-config";

/** Structured brief fields. All optional: a missing one costs points, it never blocks sending. */
export const DETAIL_KEYS = ["objective", "audience", "cta", "url", "format", "duration", "sizes", "copyReady", "eventDate", "venue", "attendees", "budget"] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];
export type Details = Partial<Record<DetailKey, string>>;

export const OBJECTIVES = ["Generate leads", "Conversion or deposits", "Awareness or reach", "Customer retention", "Internal communication"] as const;
export const VIDEO_FORMATS = ["Vertical 9:16", "Horizontal 16:9", "Square 1:1"] as const;
export const COPY_READY = "si";

export const DETAIL_LABEL: Record<DetailKey, string> = {
  objective: "Objective",
  audience: "Audience",
  cta: "Call to action",
  url: "Destination or reference URL",
  format: "Format",
  duration: "Duration in seconds",
  sizes: "Sizes and formats",
  copyReady: "Copy or script ready",
  eventDate: "Event date",
  venue: "Venue",
  attendees: "Expected attendees",
  budget: "Budget",
};

/** Where a requirement is filled in the request form, so a summary can link straight to it. */
export type RequirementStep = "brief" | "requisitos" | "cuando" | "material";

export interface RequirementInput {
  area: Area;
  subtype?: string;
  landingSubtype?: string;
  brief: string;
  market?: string;
  drive?: string;
  attachmentCount: number;
  blockers?: string;
  details?: Details;
}

export interface Requirement {
  id: string;
  label: string;
  hint: string;
  weight: number;
  step: RequirementStep;
  field: string;
  ok: (input: RequirementInput) => boolean;
}

const DETAILED_BRIEF_CHARS = 150;
const filled = (key: DetailKey) => (input: RequirementInput) => Boolean(input.details?.[key]?.trim());
const detail = (key: DetailKey, weight: number, hint: string, label: string = DETAIL_LABEL[key]): Requirement => ({
  id: key,
  label,
  hint,
  weight,
  step: "requisitos",
  field: key,
  // "Not yet" is an answer, but only a ready copy saves the team a round trip.
  ok: key === "copyReady" ? (input) => input.details?.copyReady === COPY_READY : filled(key),
});

/** What every request needs, whatever the area: 75 of the 100 points. */
const COMMON: Requirement[] = [
  {
    id: "brief",
    label: "Brief with context and specs",
    hint: "Add context, key message and specs to the brief",
    weight: 15,
    step: "brief",
    field: "brief",
    ok: (input) => input.brief.trim().length >= DETAILED_BRIEF_CHARS,
  },
  {
    id: "material",
    label: "Assets in Drive or attached",
    hint: "Add the Drive folder or attach the assets",
    weight: 15,
    step: "material",
    field: "drive",
    ok: (input) => Boolean(input.drive?.trim()) || input.attachmentCount > 0,
  },
  {
    id: "subtype",
    label: "Piece type defined",
    hint: "Choose the piece type",
    weight: 10,
    step: "brief",
    field: "subtype",
    ok: (input) => Boolean(input.subtype) && (input.area !== "web" || input.subtype !== "landing" || Boolean(input.landingSubtype)),
  },
  { id: "objective", label: "Objective defined", hint: "Choose the objective of the piece", weight: 10, step: "brief", field: "objective", ok: filled("objective") },
  { id: "audience", label: "Audience defined", hint: "Describe who it is for", weight: 10, step: "brief", field: "audience", ok: filled("audience") },
  {
    id: "blockers",
    label: "No blockers",
    hint: "Clear the blockers before starting",
    weight: 10,
    step: "requisitos",
    field: "blockers",
    ok: (input) => !input.blockers?.trim(),
  },
  { id: "market", label: "Market given", hint: "Give the market", weight: 5, step: "cuando", field: "market", ok: (input) => Boolean(input.market) },
];

/** What only that area needs to start without coming back to ask: the other 25 points. */
const BY_AREA: Record<Area, Requirement[]> = {
  web: [
    detail("url", 10, "Paste the destination or reference URL"),
    detail("cta", 10, "Define the call to action"),
    detail("copyReady", 5, "Confirm whether the copy is ready", "Final copy ready"),
  ],
  video: [
    detail("format", 10, "Choose the video format"),
    detail("copyReady", 10, "Confirm whether the script is ready", "Script ready"),
    detail("duration", 5, "Give the duration"),
  ],
  diseno: [
    detail("sizes", 10, "Give the sizes and delivery formats"),
    detail("copyReady", 10, "Confirm whether the copy is ready", "Final copy ready"),
    detail("cta", 5, "Define the call to action"),
  ],
  eventos: [
    detail("eventDate", 10, "Give the event date"),
    detail("venue", 5, "Give the venue"),
    detail("attendees", 5, "Give the expected number of attendees"),
    detail("budget", 5, "Give the budget"),
  ],
  copy: [
    detail("cta", 10, "Define the call to action"),
    detail("url", 10, "Paste the destination or reference URL"),
    detail("sizes", 5, "Give the channels and formats", "Channels and formats given"),
  ],
  digital: [
    detail("budget", 10, "Give the budget"),
    detail("url", 10, "Paste the landing or destination URL"),
    detail("cta", 5, "Define the call to action"),
  ],
  data: [
    detail("url", 15, "Link the data source or the current report", "Data source linked"),
    detail("sizes", 10, "Say how it should be delivered: dashboard, sheet or slides", "Delivery format given"),
  ],
};

/** Every requirement for an area, heaviest first; the weights add up to 100 so the score reads as a percentage. */
export function requirementsFor(area: Area): Requirement[] {
  return [...COMMON, ...BY_AREA[area]].sort((a, b) => b.weight - a.weight);
}

/** The structured fields an area asks for in its requirements step. */
export function detailKeysFor(area: Area): DetailKey[] {
  return BY_AREA[area].map((requirement) => requirement.field as DetailKey);
}
