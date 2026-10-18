import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "json-schema-to-typescript";

const contractsDir = path.join(import.meta.dir, "..", "..", "contracts");
const generatedPath = path.join(
  import.meta.dir,
  "..",
  "infrastructure",
  "contract-types.generated.ts",
);

// result.schema.json refers to profile.schema.json; only the profile pass declares the shared
// definitions (Claim, Evidence) so each type is emitted once.
const schemaFiles = [
  { file: "result.schema.json", declaresShared: false },
  { file: "profile.schema.json", declaresShared: true },
  { file: "health.schema.json", declaresShared: false },
];

async function generateContractTypes(): Promise<string> {
  const parts: string[] = [];
  for (const { file, declaresShared } of schemaFiles) {
    const schema = JSON.parse(await readFile(path.join(contractsDir, file), "utf8"));
    parts.push(
      await compile(schema, schema.title, {
        cwd: contractsDir,
        bannerComment: "",
        declareExternallyReferenced: declaresShared,
        additionalProperties: false,
        style: { printWidth: 100 },
      }),
    );
  }
  return `// Generated from contracts/*.schema.json by \`bun run contract:types\`. Do not edit.\n\n${parts.join("\n")}`;
}

if (import.meta.main) {
  const types = await generateContractTypes();
  if (process.argv.includes("--stdout")) process.stdout.write(types);
  else await writeFile(generatedPath, types);
}
