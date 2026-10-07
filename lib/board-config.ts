/**
 * The monday board this app mirrors: "Solicitudes Marketing LATAM" (atfx.monday.com/boards/18424308173).
 * Column and label ids come from the board itself; label ids are stable when someone reorders labels in monday,
 * the visual index is not, so everything here writes and reads by id.
 */

export const BOARD_ID = 18424308173;

export const COLUMNS = {
  status: "color_mm5q9pka",
  owner: "multiple_person_mm5qwrwp",
  area: "color_mm5qh2tx",
  priority: "color_mm5qrahp",
  slaDays: "numeric_mm5qkbbf",
  requesterName: "text_mm5q27rd",
  dueDate: "date_mm5q715k",
  requesterEmail: "email_mm5qc06a",
  drive: "link_mm5qnyxe",
  brief: "long_text_mm5qr9r0",
  blockers: "long_text_mm5q2fqt",
  market: "text_mm5qsbx8",
  webType: "dropdown_mm5qpws4",
  landingSubtype: "dropdown_mm5q9r7g",
  designType: "dropdown_mm5qw1x",
  eventType: "dropdown_mm5qacgt",
  videoType: "dropdown_mm5qh6py",
} as const;

/** monday users who belong to the team even with nothing assigned yet, so the directory shows the whole team. */
export const TEAM_ROSTER = ["28982466", "74311964"] as const;

export const AREAS = ["web", "video", "eventos", "diseno"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABEL: Record<Area, string> = { web: "Web", video: "Video", eventos: "Events", diseno: "Design" };
export const AREA_LABEL_ID: Record<Area, number> = { web: 7, video: 4, eventos: 9, diseno: 12 };

export const PRIORITIES = ["normal", "media", "alta", "critica"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { normal: "Normal", media: "Medium", alta: "High", critica: "Critical" };
export const PRIORITY_LABEL_ID: Record<Priority, number> = { normal: 17, media: 9, alta: 19, critica: 2 };

/** Board stages in flow order. The public board renders one column per stage. */
export const STAGES = ["nueva", "ready", "en-curso", "on-hold", "hecha"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  nueva: "New",
  ready: "Ready",
  "en-curso": "In progress",
  "on-hold": "On hold",
  hecha: "Done",
};
/** Status labels as they are named in monday, used to match a status by text when its label id is missing. */
export const STAGE_MONDAY_TEXT: Record<Stage, string> = {
  nueva: "Nueva",
  ready: "Ready",
  "en-curso": "En curso",
  "on-hold": "On hold",
  hecha: "Hecha",
};
export const STAGE_LABEL_ID: Record<Stage, number> = { nueva: 7, ready: 6, "en-curso": 4, "on-hold": 0, hecha: 1 };
export const STAGE_GROUP: Record<Stage, string> = {
  nueva: "topics",
  ready: "group_mm5qnxha",
  "en-curso": "group_mm5qg3ew",
  "on-hold": "group_mm5q1erf",
  hecha: "group_mm5qh5jb",
};

export type Subtype = { value: string; label: string; labelId: number; days: number };

/**
 * Base effort per piece in business days. First pass, to be tuned with each area owner; the owner can always
 * correct the date in monday and that is what the board shows.
 */
export const SUBTYPES: Record<Area, readonly Subtype[]> = {
  web: [
    { value: "landing", label: "New landing page", labelId: 1, days: 7 },
    { value: "cambios", label: "Round of changes", labelId: 2, days: 2 },
    { value: "infra", label: "Infrastructure or access", labelId: 3, days: 3 },
    { value: "tracking", label: "Tracking, pixels or analytics", labelId: 4, days: 2 },
    { value: "otra", label: "Something else", labelId: 5, days: 3 },
  ],
  video: [
    { value: "reel", label: "Reel", labelId: 1, days: 3 },
    { value: "promo", label: "Promo", labelId: 2, days: 5 },
    { value: "webinar", label: "Webinar", labelId: 3, days: 4 },
    { value: "testimonial", label: "Testimonial", labelId: 4, days: 5 },
  ],
  eventos: [
    { value: "interno", label: "Internal", labelId: 1, days: 10 },
    { value: "cliente", label: "Client", labelId: 2, days: 15 },
  ],
  diseno: [
    { value: "meta", label: "Meta", labelId: 1, days: 2 },
    { value: "google", label: "Google", labelId: 2, days: 2 },
    { value: "email", label: "Email", labelId: 3, days: 2 },
    { value: "landing", label: "Landing", labelId: 4, days: 4 },
    { value: "presentacion", label: "Presentation", labelId: 5, days: 3 },
    { value: "impreso", label: "Print", labelId: 7, days: 5 },
    { value: "otro", label: "Other", labelId: 6, days: 3 },
  ],
};

export const SUBTYPE_COLUMN: Record<Area, string> = {
  web: COLUMNS.webType,
  video: COLUMNS.videoType,
  eventos: COLUMNS.eventType,
  diseno: COLUMNS.designType,
};

export const LANDING_SUBTYPES = [
  { value: "captacion", label: "Lead capture", labelId: 1 },
  { value: "evento", label: "Event", labelId: 2 },
  { value: "descarga", label: "Download", labelId: 3 },
  { value: "comunidad", label: "Community", labelId: 4 },
  { value: "informativa", label: "Informational", labelId: 5 },
  { value: "otro", label: "Other", labelId: 6 },
] as const;

export const MARKETS = ["LATAM", "México", "Colombia", "Chile", "Perú", "Argentina", "Brasil", "Otro"] as const;

export function subtypeOf(area: Area, value: string): Subtype | undefined {
  return SUBTYPES[area].find((subtype) => subtype.value === value);
}
