import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig from "./next.config";

const DOCUMENT = "4f1c2a9e-7b3d-4e8a-9c61-0d5e8f2b7a34";
const SITE_HEADERS = [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
];

const POLICY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; " +
  "worker-src 'self' blob:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; " +
  "form-action 'self'; object-src 'none'";

/** The headers the config adds to a response for this path, matched as Next's router does. */
async function configHeaders(pathname: string, phase: string = PHASE_PRODUCTION_BUILD) {
  const rules = (await nextConfig(phase).headers?.()) ?? [];
  return rules
    .filter(
      (rule) =>
        getPathMatch(rule.source, {
          strict: true,
          regexModifier: (regex) => modifyRouteRegex(regex),
        })(pathname) !== false,
    )
    .flatMap((rule) => rule.headers);
}

async function configHeaderNames(pathname: string): Promise<string[]> {
  return [...new Set((await configHeaders(pathname)).map(({ key }) => key))].sort();
}

async function policy(phase: string): Promise<string | undefined> {
  const headers = await configHeaders("/", phase);
  return headers.find(({ key }) => key === "Content-Security-Policy")?.value;
}

describe("security headers", () => {
  test("pages and engine routes get every site header", async () => {
    for (const pathname of ["/", "/office", "/api/search", `/api/documents/${DOCUMENT}`]) {
      expect(await configHeaderNames(pathname)).toEqual(SITE_HEADERS);
    }
  });

  test("an uploaded file gets no site policy, so its route's sandbox policy is the one sent", async () => {
    for (const pathname of [
      `/api/documents/${DOCUMENT}/file`,
      `/api/documents/${DOCUMENT}/file/`,
    ]) {
      expect(await configHeaderNames(pathname)).toEqual(
        SITE_HEADERS.filter((name) => name !== "Content-Security-Policy"),
      );
    }
  });

  test("the built app allows no eval; only next dev does, for React's error stacks", async () => {
    expect(await policy(PHASE_PRODUCTION_BUILD)).toBe(POLICY);
    expect(await policy(PHASE_DEVELOPMENT_SERVER)).toBe(
      POLICY.replace("script-src 'self' 'unsafe-inline'", "$& 'unsafe-eval'"),
    );
  });

  test("Caddy sends the built app's policy", async () => {
    const caddyfile = path.join(import.meta.dir, "..", "infra", "exoscale", "Caddyfile");
    const sent = /\?Content-Security-Policy "([^"]+)"/.exec(await readFile(caddyfile, "utf8"));
    expect(sent?.[1]).toBe(POLICY);
  });
});
