// Compiles the contract schemas ahead of time into plain validator functions. Ajv's own compiler
// builds each validator with Function() when it runs, which the site's Content-Security-Policy
// (next.config.ts) does not allow, so the app imports these instead and never compiles a schema.
// Ajv refers to its runtime helpers with require() even in an ES module, so those references are
// turned into imports; any other require() stops the generator rather than reach the browser.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020, { _ } from "ajv/dist/2020";
import standaloneCode from "ajv/dist/standalone";
import addFormats from "ajv-formats";

const contractsDir = path.join(import.meta.dir, "..", "..", "contracts");
const outputBase = path.join(
  import.meta.dir,
  "..",
  "infrastructure",
  "contract-validators.generated",
);

// Each response the app checks, exported as `is<title>`; the profile schema is only referred to.
const checkedSchemas = [
  "result.schema.json",
  "health.schema.json",
  "quest.schema.json",
  "agent.schema.json",
  "sources.schema.json",
  "numbers.schema.json",
];
const referencedSchemas = ["profile.schema.json"];

const BANNER =
  "// Generated from contracts/*.schema.json by `bun run contract:validators`. Do not edit.";
const RUNTIME_HELPER = /require\("(ajv\/dist\/runtime\/([a-z0-9_]+))"\)\.default/g;

type Schema = { readonly $id: string; readonly title: string };

export type ContractValidators = { readonly js: string; readonly dts: string };

async function readSchema(file: string): Promise<Schema> {
  return JSON.parse(await readFile(path.join(contractsDir, file), "utf8")) as Schema;
}

function withImports(code: string): string {
  const helpers = new Map<string, string>();
  const body = code
    .replace(/^"use strict";/, "")
    .replace(RUNTIME_HELPER, (_match, module: string, name: string) => {
      const local = `runtime_${name}`;
      helpers.set(local, module);
      return local;
    });
  if (body.includes("require(")) throw new Error("validators refer to a module not imported");
  const imports = [...helpers]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([local, module]) => `import ${local} from "${module}";`);
  return [
    BANNER,
    'import { fullFormats } from "ajv-formats/dist/formats";',
    ...imports,
    body.trim(),
    "",
  ].join("\n");
}

function declarations(checked: readonly Schema[]): string {
  const titles = checked.map((schema) => schema.title);
  return [
    BANNER,
    `import type { ${[...titles].sort().join(", ")} } from "./contract-types.generated";`,
    "",
    ...titles.map(
      (title) => `export declare const is${title}: (data: unknown) => data is ${title};`,
    ),
    "",
  ].join("\n");
}

export async function generateContractValidators(): Promise<ContractValidators> {
  const checked = await Promise.all(checkedSchemas.map(readSchema));
  const referenced = await Promise.all(referencedSchemas.map(readSchema));
  const ajv = new Ajv2020({
    strict: true,
    code: { source: true, esm: true, lines: true, formats: _`fullFormats` },
  });
  addFormats(ajv);
  ajv.addSchema([...referenced, ...checked]);
  const exports = Object.fromEntries(checked.map((schema) => [`is${schema.title}`, schema.$id]));
  return { js: withImports(standaloneCode(ajv, exports)), dts: declarations(checked) };
}

if (import.meta.main) {
  const { js, dts } = await generateContractValidators();
  await writeFile(`${outputBase}.js`, js);
  await writeFile(`${outputBase}.d.ts`, dts);
}
