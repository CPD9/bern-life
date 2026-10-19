import path from "node:path";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The same headers as infra/exoscale/Caddyfile, so make run and next dev send them too. Inline
// scripts stay allowed for the settings boot script in app/layout.tsx. React uses eval in
// development only (next dev), to rebuild server error stacks in the dev overlay.
function securityHeaders(development: boolean): { key: string; value: string }[] {
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  return [
    { key: "Content-Security-Policy", value: policy.join("; ") },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}

export default function nextConfig(phase: string): NextConfig {
  return {
    cacheComponents: true,
    partialPrefetching: true,
    poweredByHeader: false,
    // The dev badge sits over the shell and the phone; build errors still show as an overlay.
    devIndicators: false,
    headers: async () => [
      { source: "/:path*", headers: securityHeaders(phase === PHASE_DEVELOPMENT_SERVER) },
    ],
    turbopack: {
      // The app imports schemas and fixtures from ../contracts, the source of truth between lanes.
      root: path.join(__dirname, ".."),
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };
}
