"use client";

import { useSyncExternalStore } from "react";
import { ThemeSwitch, type Theme } from "@/components/arc/theme-switch/theme-switch";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function apply(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}

/** Reads the theme the inline head script already set, so the first client render matches the painted page. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  return (
    <ThemeSwitch
      theme={theme}
      variant="rise"
      iconOnly
      label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onThemeChange={(next) => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced || !document.startViewTransition) return apply(next);
        document.startViewTransition(() => apply(next));
      }}
    />
  );
}
