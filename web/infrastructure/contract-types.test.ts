import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The generator runs in its own process: the schema resolver it uses treats the test DOM as a
// browser and cannot resolve local files there.
test("contract-types.generated.ts is up to date with contracts/", async () => {
  const web = path.join(import.meta.dir, "..");
  const run = Bun.spawnSync(["bun", "scripts/contract-types.ts", "--stdout"], { cwd: web });
  expect(run.exitCode).toBe(0);
  expect(await readFile(path.join(import.meta.dir, "contract-types.generated.ts"), "utf8")).toBe(
    run.stdout.toString(),
  );
});
