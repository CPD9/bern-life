import path from "node:path";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// The same headers as infra/exoscale/Caddyfile, so make run and next dev send them too. Inline
// scripts stay allowed for the settings boot script in app/layout.tsx. Nothing the app serves
// needs eval: the contract validators are compiled ahead of time (scripts/contract-validators.ts).
// Only next dev allows it, because React uses it there to rebuild server error stacks.
function contentSecurityPolicy(dev: boolean): string {
  return [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
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
  ].join("; ");
}

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// An uploaded PDF keeps its route's own policy, `sandbox` (features/documents/http.ts): Next sends
// a route's header only when no rule here set it, so a site policy would replace the sandbox.
const OUTSIDE_UPLOADED_FILES = "/((?!api/documents/[^/]+/file/?$).*)";

export default function nextConfig(phase: string): NextConfig {
  const policy = contentSecurityPolicy(phase === PHASE_DEVELOPMENT_SERVER);
  return {
    cacheComponents: true,
    partialPrefetching: true,
    poweredByHeader: false,
    // The dev badge sits over the shell and the phone; build errors still show as an overlay.
    devIndicators: false,
    headers: async () => [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: OUTSIDE_UPLOADED_FILES,
        headers: [{ key: "Content-Security-Policy", value: policy }],
      },
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
