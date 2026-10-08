import type { NextConfig } from "next";

// No other site may frame the hub (clickjacking on comments and requests). Forms post here or to monday's OAuth only.
// HACK: no script-src yet, the inline theme script needs a nonce first. Nonce based CSP before any user HTML is rendered.
const CSP = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self' https://auth.monday.com"].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Team profile photos come from monday's file CDN.
  images: { remotePatterns: [{ protocol: "https", hostname: "files.monday.com", pathname: "/**/photos/**" }] },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
