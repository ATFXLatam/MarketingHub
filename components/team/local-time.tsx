"use client";

import { useMemo, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

// Minute precision keeps the snapshot stable between ticks, so React only re-renders when the shown time changes.
const readMinute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** A member's wall clock, so requesters across LATAM know whether a reply is likely right now. Rendered only on the client. */
export function LocalTime({ timeZone }: { timeZone: string }) {
  const clock = useMemo(() => new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone }), [timeZone]);
  const minute = useSyncExternalStore(subscribe, readMinute, () => null);
  return minute === null ? null : <time>{clock.format(minute)} hora local</time>;
}
