import "server-only";

/**
 * Who may submit requests: by email domain from ALLOWED_EMAIL_DOMAINS, so onboarding someone is an env change and not
 * a deploy. Checked on the server in every place that acts (page, Server Action, upload signing); a gate that only
 * lives in a component does not stop a direct call to the action.
 */
function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  const domains = allowedDomains();
  // A forgotten variable must not open the door in production; locally it would only block development.
  if (domains.length === 0) return process.env.VERCEL_ENV !== "production";
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain) && domains.includes(domain);
}
