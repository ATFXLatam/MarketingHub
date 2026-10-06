import type { PublicTask } from "./public-dto";

export interface BoardMetrics {
  inProgress: number;
  queued: number;
  done: number;
  /** Mean estimated turnaround of open work, in whole business days; 0 when nothing open carries an estimate. */
  averageSla: number;
}

export function boardMetrics(tasks: PublicTask[]): BoardMetrics {
  const open = tasks.filter((task) => task.stage !== "hecha");
  const estimates = open.map((task) => task.slaDays).filter((days): days is number => days !== null);
  return {
    inProgress: tasks.filter((task) => task.stage === "en-curso").length,
    queued: tasks.filter((task) => task.stage === "nueva" || task.stage === "ready").length,
    done: tasks.filter((task) => task.stage === "hecha").length,
    averageSla: estimates.length ? Math.round(estimates.reduce((sum, days) => sum + days, 0) / estimates.length) : 0,
  };
}
