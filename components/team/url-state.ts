"use client";

import { useSyncExternalStore } from "react";

const URL_CHANGE = "hub:url";

function subscribe(onChange: () => void) {
  addEventListener("popstate", onChange);
  addEventListener(URL_CHANGE, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(URL_CHANGE, onChange);
  };
}

/** A query parameter as state, so a filter or an open panel survives a reload and can be shared as a link. */
export function useUrlParam(name: string): string | null {
  return useSyncExternalStore(subscribe, () => new URLSearchParams(location.search).get(name), () => null);
}

export function setUrlParam(name: string, value: string | null): void {
  const url = new URL(location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  history.replaceState(null, "", url);
  dispatchEvent(new Event(URL_CHANGE));
}

export const PERSON_PARAM = "persona";
