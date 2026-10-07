import type { Area } from "./board-config";

/** Structured brief fields. All optional: a missing one costs points, it never blocks sending. */
export const DETAIL_KEYS = ["objective", "audience", "cta", "url", "format", "duration", "sizes", "copyReady", "eventDate", "venue", "attendees", "budget"] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];
export type Details = Partial<Record<DetailKey, string>>;

export const OBJECTIVES = ["Generar leads", "Conversión o depósitos", "Awareness o alcance", "Retención de clientes", "Comunicación interna"] as const;
export const VIDEO_FORMATS = ["Vertical 9:16", "Horizontal 16:9", "Cuadrado 1:1"] as const;
export const COPY_READY = "si";

export const DETAIL_LABEL: Record<DetailKey, string> = {
  objective: "Objetivo",
  audience: "Público",
  cta: "Llamado a la acción",
  url: "URL de destino o referencia",
  format: "Formato",
  duration: "Duración en segundos",
  sizes: "Medidas y formatos",
  copyReady: "Copy o guion listo",
  eventDate: "Fecha del evento",
  venue: "Lugar",
  attendees: "Asistentes esperados",
  budget: "Presupuesto",
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
  // "Todavía no" is an answer, but only a ready copy saves the team a round trip.
  ok: key === "copyReady" ? (input) => input.details?.copyReady === COPY_READY : filled(key),
});

/** What every request needs, whatever the area: 75 of the 100 points. */
const COMMON: Requirement[] = [
  {
    id: "brief",
    label: "Brief con contexto y especificaciones",
    hint: "Detalla contexto, mensaje clave y especificaciones en el brief",
    weight: 15,
    step: "brief",
    field: "brief",
    ok: (input) => input.brief.trim().length >= DETAILED_BRIEF_CHARS,
  },
  {
    id: "material",
    label: "Material en Drive o adjuntos",
    hint: "Agrega la carpeta Drive o adjuntos con el material",
    weight: 15,
    step: "material",
    field: "drive",
    ok: (input) => Boolean(input.drive?.trim()) || input.attachmentCount > 0,
  },
  {
    id: "subtype",
    label: "Tipo de pieza definido",
    hint: "Elige el tipo de pieza",
    weight: 10,
    step: "brief",
    field: "subtype",
    ok: (input) => Boolean(input.subtype) && (input.area !== "web" || input.subtype !== "landing" || Boolean(input.landingSubtype)),
  },
  { id: "objective", label: "Objetivo definido", hint: "Elige el objetivo de la pieza", weight: 10, step: "brief", field: "objective", ok: filled("objective") },
  { id: "audience", label: "Público definido", hint: "Describe a quién va dirigida", weight: 10, step: "brief", field: "audience", ok: filled("audience") },
  {
    id: "blockers",
    label: "Sin bloqueadores",
    hint: "Resuelve los bloqueadores antes de arrancar",
    weight: 10,
    step: "requisitos",
    field: "blockers",
    ok: (input) => !input.blockers?.trim(),
  },
  { id: "market", label: "Mercado indicado", hint: "Indica el mercado", weight: 5, step: "cuando", field: "market", ok: (input) => Boolean(input.market) },
];

/** What only that area needs to start without coming back to ask: the other 25 points. */
const BY_AREA: Record<Area, Requirement[]> = {
  web: [
    detail("url", 10, "Pega la URL de destino o la de referencia"),
    detail("cta", 10, "Define el llamado a la acción"),
    detail("copyReady", 5, "Confirma si el copy está listo", "Copy final listo"),
  ],
  video: [
    detail("format", 10, "Elige el formato del video"),
    detail("copyReady", 10, "Confirma si el guion está listo", "Guion listo"),
    detail("duration", 5, "Indica la duración"),
  ],
  diseno: [
    detail("sizes", 10, "Indica medidas y formatos de entrega"),
    detail("copyReady", 10, "Confirma si el copy está listo", "Copy final listo"),
    detail("cta", 5, "Define el llamado a la acción"),
  ],
  eventos: [
    detail("eventDate", 10, "Indica la fecha del evento"),
    detail("venue", 5, "Indica el lugar"),
    detail("attendees", 5, "Indica cuántos asistentes esperas"),
    detail("budget", 5, "Indica el presupuesto"),
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
