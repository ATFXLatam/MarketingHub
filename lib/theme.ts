export const THEME_STORAGE_KEY = "theme";
export type ThemePreference = "light" | "dark" | "system";

/** Stored choice, or "system" when the person never picked one (or storage is blocked). */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Saves the choice and sets data-theme; "system" clears the choice and follows the OS. */
export function applyPreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Blocked storage: the theme still applies for this visit.
  }
  const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
