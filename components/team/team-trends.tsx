"use client";

import { useMemo } from "react";
import { MetricsDashboard, type DashboardBreakdown, type DashboardRange } from "@/components/arc/blocks/metrics-dashboard/metrics-dashboard";
import type { PublicEvent, PublicTask } from "@/lib/public-dto";
import { dailyCounts, requestBreakdowns } from "@/lib/team-metrics";

const METRICS = [
  { key: "nuevas", label: "New requests" },
  { key: "movimientos", label: "Activity" },
  { key: "entregadas", label: "Delivered" },
];

const RANGES: DashboardRange[] = [
  { value: "7d", label: "7D", long: "Last 7 days", days: 7, step: 1 },
  { value: "14d", label: "14D", long: "Last 14 days", days: 14, step: 1 },
  { value: "30d", label: "30D", long: "Last 30 days", days: 30, step: 1 },
];

// Twice the longest range, so each range can compare against the period before it.
const SERIES_DAYS = 2 * Math.max(...RANGES.map((range) => range.days));

export interface TeamTrendsProps {
  tasks: PublicTask[];
  activity: PublicEvent[];
  today: string;
}

/** How the flow of requests is changing: what came in, what moved, and what shipped, per day. */
export function TeamTrends({ tasks, activity, today }: TeamTrendsProps) {
  const daily = useMemo(() => dailyCounts(tasks, activity, today, SERIES_DAYS), [tasks, activity, today]);
  const breakdowns = useMemo(
    () =>
      Object.fromEntries(
        RANGES.map((range): [string, DashboardBreakdown[]] => {
          const { areas, markets } = requestBreakdowns(tasks, today, range.days);
          return [range.value, [{ title: "By area", column: "Requests", rows: areas }, { title: "By market", column: "Requests", rows: markets }]];
        }),
      ),
    [tasks, today],
  );
  return <MetricsDashboard title="Team pace" subtitle="From monday" metrics={METRICS} daily={daily} ranges={RANGES} breakdowns={breakdowns} defaultRange="30d" />;
}
