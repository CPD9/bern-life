// Every file served from public/world must be listed in its manifest with a matching sha256, and
// the folder stays under 5 MB. Any file added without a manifest row fails here.

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type Manifest = { files: { path: string; sha256: string; licence: string; source: string }[] };

const ASSETS_DIR = join(import.meta.dir, "..", "..", "public", "world");
const MANIFEST = "manifest.json";
const MAX_BYTES = 5 * 1024 * 1024;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("world assets", () => {
  const manifest = JSON.parse(readFileSync(join(ASSETS_DIR, MANIFEST), "utf8")) as Manifest;
  const files = filesUnder(ASSETS_DIR)
    .map((path) => relative(ASSETS_DIR, path))
    .filter((path) => path !== MANIFEST)
    .sort();

  test("the manifest lists exactly the files in the folder", () => {
    expect(manifest.files.map((file) => file.path).sort()).toEqual(files);
  });

  test("each file matches its pinned sha256 and names a licence and source", () => {
    for (const entry of manifest.files) {
      const bytes = readFileSync(join(ASSETS_DIR, entry.path));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
      expect(entry.licence).toMatch(/^(CC0-1\.0|MIT|swisstopo-OGD)$/);
      expect(entry.source).toStartWith("https://");
    }
  });

  test("the folder stays under 5 MB", () => {
    const total = files.reduce((sum, path) => sum + statSync(join(ASSETS_DIR, path)).size, 0);
    expect(total).toBeLessThan(MAX_BYTES);
  });
});
