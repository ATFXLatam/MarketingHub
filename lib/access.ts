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
  // A forgotten variable keeps the door shut on every deployment, previews included: they hold the real monday token.
  if (domains.length === 0) return process.env.NODE_ENV === "development";
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain) && domains.includes(domain);
}

interface ClerkLikeUser {
  primaryEmailAddress?: { emailAddress: string; verification?: { status?: string | null } | null } | null;
}

/** The user's email when it is verified and allowed; an unverified address could be anyone's claim to the domain. */
export function allowedEmail(user: ClerkLikeUser | null | undefined): string | null {
  const address = user?.primaryEmailAddress;
  if (!address || address.verification?.status !== "verified") return null;
  return isAllowedEmail(address.emailAddress) ? address.emailAddress : null;
}
