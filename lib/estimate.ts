import { subtypeOf, type Area, type Priority, type Stage } from "./board-config";

export interface EstimateInput {
  area: Area;
  subtype?: string;
  landingSubtype?: string;
  priority: Priority;
  brief: string;
  market?: string;
  drive?: string;
  attachmentCount: number;
  blockers?: string;
  /** Request day as YYYY-MM-DD, passed in so the result never depends on the clock. */
  today: string;
  dueDate?: string;
}

export type BriefTier = "completo" | "parcial" | "incompleto";

export interface Estimate {
  score: number;
  tier: BriefTier;
  missing: string[];
  /** The same missing pieces with where to fill each one in, heaviest first. */
  gaps: BriefGap[];
  /** The pieces the brief already has, heaviest first. */
  met: BriefGap[];
  breakdown: DeliveryDays;
  days: number;
  date: string;
  /** The requested date falls before what the team can deliver. */
  tight: boolean;
  initialStage: Stage;
}

const DETAILED_BRIEF_CHARS = 150;
const FALLBACK_DAYS = 3;
const TIER_PENALTY_DAYS: Record<BriefTier, number> = { completo: 0, parcial: 2, incompleto: 4 };
// Priority reorders the queue; it shortens the turnaround, it does not make the work smaller, hence a floor of one day.
const PRIORITY_FACTOR: Record<Priority, number> = { normal: 1, media: 1, alta: 0.75, critica: 0.5 };

/** Where in the request form a missing piece is filled in, so the summary can take the person straight there. */
export interface BriefGap {
  hint: string;
  label: string;
  step: "brief" | "cuando" | "material";
  field: string;
}

type Check = BriefGap & { weight: number; ok: (input: EstimateInput) => boolean };

const CHECKS: Check[] = [
  {
    weight: 35,
    ok: (input) => input.brief.trim().length >= DETAILED_BRIEF_CHARS,
    hint: "Detalla objetivo, público, formato y copy en el brief",
    label: "Brief con objetivo, público, formato y copy",
    step: "brief",
    field: "brief",
  },
  {
    weight: 25,
    ok: (input) => Boolean(input.drive?.trim()) || input.attachmentCount > 0,
    hint: "Agrega la carpeta Drive o adjuntos con el material",
    label: "Material en Drive o adjuntos",
    step: "material",
    field: "drive",
  },
  {
    weight: 15,
    ok: (input) =>
      Boolean(input.subtype) && (input.subtype !== "landing" || input.area !== "web" || Boolean(input.landingSubtype)),
    hint: "Elige el tipo de pieza",
    label: "Tipo de pieza definido",
    step: "brief",
    field: "subtype",
  },
  { weight: 10, ok: (input) => Boolean(input.market), hint: "Indica el mercado", label: "Mercado indicado", step: "cuando", field: "market" },
  { weight: 15, ok: (input) => !input.blockers?.trim(), hint: "Resuelve los bloqueadores antes de arrancar", label: "Sin bloqueadores", step: "brief", field: "blockers" },
];

/** What a complete brief carries, heaviest first, for anything that explains the score outside the form. */
export const BRIEF_CHECKS: readonly { weight: number; hint: string; label: string }[] = [...CHECKS]
  .sort((a, b) => b.weight - a.weight)
  .map(({ weight, hint, label }) => ({ weight, hint, label }));

export function tierFor(score: number): BriefTier {
  return score >= 80 ? "completo" : score >= 50 ? "parcial" : "incompleto";
}

const gapOf = ({ hint, label, step, field }: Check): BriefGap => ({ hint, label, step, field });
const BY_WEIGHT = [...CHECKS].sort((a, b) => b.weight - a.weight);

export function briefQuality(input: EstimateInput): { score: number; tier: BriefTier; missing: string[]; gaps: BriefGap[]; met: BriefGap[] } {
  const score = CHECKS.reduce((total, check) => total + (check.ok(input) ? check.weight : 0), 0);
  const missing = CHECKS.filter((check) => !check.ok(input)).map((check) => check.hint);
  return {
    score,
    tier: tierFor(score),
    missing,
    gaps: BY_WEIGHT.filter((check) => !check.ok(input)).map(gapOf),
    met: BY_WEIGHT.filter((check) => check.ok(input)).map(gapOf),
  };
}

export interface DeliveryDays {
  /** Business days the piece type takes. */
  base: number;
  /** Days priority takes off (zero or negative). */
  priority: number;
  /** Days an incomplete brief adds. */
  brief: number;
  days: number;
}

/** Where the delivery days come from, so the form and the calculator explain the same number. */
export function deliveryDays(area: Area, subtype: string | undefined, priority: Priority, tier: BriefTier): DeliveryDays {
  const base = (subtype && subtypeOf(area, subtype)?.days) || FALLBACK_DAYS;
  const prioritized = Math.max(1, Math.ceil(base * PRIORITY_FACTOR[priority]));
  return { base, priority: prioritized - base, brief: TIER_PENALTY_DAYS[tier], days: prioritized + TIER_PENALTY_DAYS[tier] };
}

// HACK: Monday to Friday only, no holidays. Add a holiday calendar per market when a date lands on one and someone notices.
export function addBusinessDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return date.toISOString().slice(0, 10);
}

export function estimate(input: EstimateInput): Estimate {
  const { score, tier, missing, gaps, met } = briefQuality(input);
  const breakdown = deliveryDays(input.area, input.subtype, input.priority, tier);
  const { days } = breakdown;
  const date = addBusinessDays(input.today, days);
  const blocked = Boolean(input.blockers?.trim());
  return {
    score,
    tier,
    missing,
    gaps,
    met,
    breakdown,
    days,
    date,
    tight: Boolean(input.dueDate) && input.dueDate! < date,
    initialStage: tier === "completo" && !blocked ? "ready" : "nueva",
  };
}
