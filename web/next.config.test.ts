import { describe, expect, test } from "bun:test";
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

/** The header names the config adds to a response for this path, matched as Next's router does. */
async function configHeaderNames(pathname: string): Promise<string[]> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const matching = rules.filter(
    (rule) =>
      getPathMatch(rule.source, {
        strict: true,
        regexModifier: (regex) => modifyRouteRegex(regex),
      })(pathname) !== false,
  );
  return [...new Set(matching.flatMap((rule) => rule.headers.map(({ key }) => key)))].sort();
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
});
