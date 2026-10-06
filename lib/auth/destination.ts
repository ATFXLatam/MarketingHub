const DEFAULT_DESTINATION = "/solicitar";
const PLACEHOLDER = "https://placeholder.local";

/** Only same-origin paths, so a crafted ?redirect_url cannot bounce a fresh session to another site. */
export function safeDestination(value: string | null, currentOrigin?: string): string {
  if (!value) return DEFAULT_DESTINATION;
  try {
    const url = new URL(value, PLACEHOLDER);
    const local = url.origin === PLACEHOLDER || url.origin === currentOrigin;
    return local ? `${url.pathname}${url.search}` : DEFAULT_DESTINATION;
  } catch {
    return DEFAULT_DESTINATION;
  }
}
