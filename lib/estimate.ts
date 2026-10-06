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

type Check = { weight: number; ok: (input: EstimateInput) => boolean; hint: string };

const CHECKS: Check[] = [
  {
    weight: 35,
    ok: (input) => input.brief.trim().length >= DETAILED_BRIEF_CHARS,
    hint: "Detalla objetivo, público, formato y copy en el brief",
  },
  {
    weight: 25,
    ok: (input) => Boolean(input.drive?.trim()) || input.attachmentCount > 0,
    hint: "Agrega la carpeta Drive o adjuntos con el material",
  },
  {
    weight: 15,
    ok: (input) =>
      Boolean(input.subtype) && (input.subtype !== "landing" || input.area !== "web" || Boolean(input.landingSubtype)),
    hint: "Elige el tipo de pieza",
  },
  { weight: 10, ok: (input) => Boolean(input.market), hint: "Indica el mercado" },
  { weight: 15, ok: (input) => !input.blockers?.trim(), hint: "Resuelve los bloqueadores antes de arrancar" },
];

export function briefQuality(input: EstimateInput): { score: number; tier: BriefTier; missing: string[] } {
  const score = CHECKS.reduce((total, check) => total + (check.ok(input) ? check.weight : 0), 0);
  const missing = CHECKS.filter((check) => !check.ok(input)).map((check) => check.hint);
  const tier: BriefTier = score >= 80 ? "completo" : score >= 50 ? "parcial" : "incompleto";
  return { score, tier, missing };
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
  const { score, tier, missing } = briefQuality(input);
  const base = (input.subtype && subtypeOf(input.area, input.subtype)?.days) || FALLBACK_DAYS;
  const days = Math.max(1, Math.ceil(base * PRIORITY_FACTOR[input.priority])) + TIER_PENALTY_DAYS[tier];
  const date = addBusinessDays(input.today, days);
  const blocked = Boolean(input.blockers?.trim());
  return {
    score,
    tier,
    missing,
    days,
    date,
    tight: Boolean(input.dueDate) && input.dueDate! < date,
    initialStage: tier === "completo" && !blocked ? "ready" : "nueva",
  };
}
