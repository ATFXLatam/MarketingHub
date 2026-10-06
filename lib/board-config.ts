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

export const AREAS = ["web", "video", "eventos", "diseno"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABEL: Record<Area, string> = { web: "Web", video: "Video", eventos: "Eventos", diseno: "Diseño" };
export const AREA_LABEL_ID: Record<Area, number> = { web: 7, video: 4, eventos: 9, diseno: 12 };

export const PRIORITIES = ["normal", "media", "alta", "critica"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { normal: "Normal", media: "Media", alta: "Alta", critica: "Crítica" };
export const PRIORITY_LABEL_ID: Record<Priority, number> = { normal: 17, media: 9, alta: 19, critica: 2 };

/** Board stages in flow order. The public board renders one column per stage. */
export const STAGES = ["nueva", "ready", "en-curso", "on-hold", "hecha"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
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
    { value: "landing", label: "Landing page nueva", labelId: 1, days: 7 },
    { value: "cambios", label: "Ronda de cambios", labelId: 2, days: 2 },
    { value: "infra", label: "Infraestructura o accesos", labelId: 3, days: 3 },
    { value: "tracking", label: "Tracking, píxeles o analítica", labelId: 4, days: 2 },
    { value: "otra", label: "Otra cosa", labelId: 5, days: 3 },
  ],
  video: [
    { value: "reel", label: "Reel", labelId: 1, days: 3 },
    { value: "promo", label: "Promo", labelId: 2, days: 5 },
    { value: "webinar", label: "Webinar", labelId: 3, days: 4 },
    { value: "testimonial", label: "Testimonial", labelId: 4, days: 5 },
  ],
  eventos: [
    { value: "interno", label: "Interno", labelId: 1, days: 10 },
    { value: "cliente", label: "Cliente", labelId: 2, days: 15 },
  ],
  diseno: [
    { value: "meta", label: "Meta", labelId: 1, days: 2 },
    { value: "google", label: "Google", labelId: 2, days: 2 },
    { value: "email", label: "Email", labelId: 3, days: 2 },
    { value: "landing", label: "Landing", labelId: 4, days: 4 },
    { value: "presentacion", label: "Presentación", labelId: 5, days: 3 },
    { value: "impreso", label: "Impreso", labelId: 7, days: 5 },
    { value: "otro", label: "Otro", labelId: 6, days: 3 },
  ],
};

export const SUBTYPE_COLUMN: Record<Area, string> = {
  web: COLUMNS.webType,
  video: COLUMNS.videoType,
  eventos: COLUMNS.eventType,
  diseno: COLUMNS.designType,
};

export const LANDING_SUBTYPES = [
  { value: "captacion", label: "Captación", labelId: 1 },
  { value: "evento", label: "Evento", labelId: 2 },
  { value: "descarga", label: "Descarga", labelId: 3 },
  { value: "comunidad", label: "Comunidad", labelId: 4 },
  { value: "informativa", label: "Informativa", labelId: 5 },
  { value: "otro", label: "Otro", labelId: 6 },
] as const;

export const MARKETS = ["LATAM", "México", "Colombia", "Chile", "Perú", "Argentina", "Brasil", "Otro"] as const;

export function subtypeOf(area: Area, value: string): Subtype | undefined {
  return SUBTYPES[area].find((subtype) => subtype.value === value);
}
