import { AREA_LABEL } from "./board-config";
import { TEAM_TIME_ZONE, todayIn } from "./dates";
import type { PublicEvent, PublicTask } from "./public-dto";

export const METRIC_KEYS = ["nuevas", "movimientos", "entregadas"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface DayValues {
  /** YYYY-MM-DD in the team's time zone. */
  date: string;
  values: Record<MetricKey, number>;
}

export interface BreakdownRow {
  name: string;
  value: number;
}

const teamDay = (iso: string) => todayIn(TEAM_TIME_ZONE, new Date(iso));

/** The calendar date `offset` days away from a YYYY-MM-DD date. */
export function shiftDay(isoDate: string, offset: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

/** One row per team day, oldest first and ending today, so every range and its previous period read from the same series. */
export function dailyCounts(tasks: PublicTask[], activity: PublicEvent[], today: string, days: number): DayValues[] {
  const rows = Array.from({ length: days }, (_, index) => ({ date: shiftDay(today, index - days + 1), values: { nuevas: 0, movimientos: 0, entregadas: 0 } }));
  const byDate = new Map(rows.map((row) => [row.date, row.values]));
  tasks.forEach((task) => {
    const values = byDate.get(teamDay(task.createdAt));
    if (values) values.nuevas += 1;
  });
  activity.forEach((event) => {
    const values = byDate.get(teamDay(event.at));
    if (!values) return;
    values.movimientos += 1;
    if (event.stage === "hecha") values.entregadas += 1;
  });
  return rows;
}

/** Requests created in the last `days` days, counted by area and by market, largest first. */
export function requestBreakdowns(tasks: PublicTask[], today: string, days: number): { areas: BreakdownRow[]; markets: BreakdownRow[] } {
  const from = shiftDay(today, -days + 1);
  const recent = tasks.filter((task) => teamDay(task.createdAt) >= from);
  const count = (names: string[]) =>
    [...names.reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map<string, number>())]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return {
    areas: count(recent.map((task) => (task.area ? AREA_LABEL[task.area] : "No area"))),
    markets: count(recent.map((task) => task.market ?? "No market")),
  };
}
