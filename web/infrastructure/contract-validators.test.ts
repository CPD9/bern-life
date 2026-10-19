import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateContractValidators } from "@/scripts/contract-validators";

const web = path.join(import.meta.dir, "..");

test("contract-validators.generated.js and .d.ts are up to date with contracts/", async () => {
  const { js, dts } = await generateContractValidators();
  const generated = path.join(import.meta.dir, "contract-validators.generated");
  expect(await readFile(`${generated}.js`, "utf8")).toBe(js);
  expect(await readFile(`${generated}.d.ts`, "utf8")).toBe(dts);
});

// Ajv's compiler builds each validator with Function(), which the Content-Security-Policy refuses,
// so only the generator script and tests may load it.
test("no module the app serves loads Ajv's schema compiler", async () => {
  const compiler = /from "(ajv(\/dist\/(2019|2020|core|jtd))?|ajv-formats)"/;
  const loading: string[] = [];
  for (const folder of ["app", "features", "infrastructure"]) {
    for await (const file of new Bun.Glob(`${folder}/**/*.{ts,tsx,js}`).scan({ cwd: web })) {
      if (/\.test\.tsx?$/.test(file)) continue;
      if (compiler.test(await readFile(path.join(web, file), "utf8"))) loading.push(file);
    }
  }
  expect(loading).toEqual([]);
});
