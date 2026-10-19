import path from "node:path";
import type { NextConfig } from "next";

// The same headers as infra/exoscale/Caddyfile, so make run and next dev send them too. Inline
// scripts stay allowed for the settings boot script in app/layout.tsx. Eval stays allowed because
// Ajv compiles the contract schemas with Function() in the browser (infrastructure/contract.ts),
// and React uses it under next dev to rebuild server error stacks.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The dev badge sits over the shell and the phone; build errors still show as an overlay.
  devIndicators: false,
  headers: async () => [
    { source: "/:path*", headers: SECURITY_HEADERS },
    {
      source: OUTSIDE_UPLOADED_FILES,
      headers: [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }],
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

export default nextConfig;
