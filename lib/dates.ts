// The team plans in Mexico City time; a request sent at 8 pm there is still "today" for them, not tomorrow UTC.
export const TEAM_TIME_ZONE = "America/Mexico_City";

/** Calendar date (YYYY-MM-DD) in the team's time zone. */
export function todayIn(timeZone: string = TEAM_TIME_ZONE, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

const DISPLAY = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Oct 14" for a YYYY-MM-DD date, read as a calendar date so no time zone can shift it by a day. */
export function formatDay(isoDate: string): string {
  return DISPLAY.format(new Date(`${isoDate}T00:00:00Z`));
}
