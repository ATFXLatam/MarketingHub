const DEFAULT_DESTINATION = "/solicitar";
const PLACEHOLDER = "https://placeholder.local";

/** Only same-origin paths, so a crafted ?redirect_url cannot bounce a fresh session to another site. */
export function safeDestination(value: string | null, currentOrigin?: string): string {
  if (!value) return DEFAULT_DESTINATION;
  try {
    const url = new URL(value, PLACEHOLDER);
    const local = url.origin === PLACEHOLDER || url.origin === currentOrigin;
    const path = `${url.pathname}${url.search}`;
    // Dot segments can normalize "/.//evil.com" into "//evil.com", which the router reads as another host.
    return local && path.startsWith("/") && !path.startsWith("//") ? path : DEFAULT_DESTINATION;
  } catch {
    return DEFAULT_DESTINATION;
  }
}
