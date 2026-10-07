import { subtypeOf, type Area, type Priority, type Stage } from "./board-config";
import { requirementsFor, type Requirement, type RequirementInput, type RequirementStep } from "./requirements";

export interface EstimateInput extends RequirementInput {
  priority: Priority;
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

const FALLBACK_DAYS = 3;
const TIER_PENALTY_DAYS: Record<BriefTier, number> = { completo: 0, parcial: 2, incompleto: 4 };
// Priority reorders the queue; it shortens the turnaround, it does not make the work smaller, hence a floor of one day.
const PRIORITY_FACTOR: Record<Priority, number> = { normal: 1, media: 1, alta: 0.75, critica: 0.5 };

/** A requirement as the summary shows it: what it is, how to fix it, and where in the form. */
export interface BriefGap {
  hint: string;
  label: string;
  step: RequirementStep;
  field: string;
  weight: number;
}

export function tierFor(score: number): BriefTier {
  return score >= 80 ? "completo" : score >= 50 ? "parcial" : "incompleto";
}

const gapOf = ({ hint, label, step, field, weight }: Requirement): BriefGap => ({ hint, label, step, field, weight });

export function briefQuality(input: RequirementInput): { score: number; tier: BriefTier; missing: string[]; gaps: BriefGap[]; met: BriefGap[] } {
  const requirements = requirementsFor(input.area);
  const met = requirements.filter((requirement) => requirement.ok(input));
  const gaps = requirements.filter((requirement) => !requirement.ok(input));
  const score = met.reduce((total, requirement) => total + requirement.weight, 0);
  return { score, tier: tierFor(score), missing: gaps.map((gap) => gap.hint), gaps: gaps.map(gapOf), met: met.map(gapOf) };
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
