import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Team profile photos come from monday's file CDN.
  images: { remotePatterns: [{ protocol: "https", hostname: "files.monday.com", pathname: "/**/photos/**" }] },
};

export default nextConfig;
