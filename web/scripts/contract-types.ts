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

// Schemas refer to each other (agent → result → profile), so a pass declares the definitions it
// refers to only when no other pass does: profile declares Claim and Evidence, numbers declares
// EvalNumbers. A short bounded array would become a union of one tuple per length, so the agent's
// lists (at most 4 or 6 items) stay arrays.
const schemaFiles = [
  { file: "result.schema.json", declaresShared: false, plainArrays: false },
  { file: "profile.schema.json", declaresShared: true, plainArrays: false },
  { file: "health.schema.json", declaresShared: false, plainArrays: false },
  { file: "quest.schema.json", declaresShared: false, plainArrays: false },
  { file: "agent.schema.json", declaresShared: false, plainArrays: true },
  { file: "sources.schema.json", declaresShared: false, plainArrays: false },
  { file: "numbers.schema.json", declaresShared: true, plainArrays: false },
];

async function generateContractTypes(): Promise<string> {
  const parts: string[] = [];
  for (const { file, declaresShared, plainArrays } of schemaFiles) {
    const schema = JSON.parse(await readFile(path.join(contractsDir, file), "utf8"));
    parts.push(
      await compile(schema, schema.title, {
        cwd: contractsDir,
        bannerComment: "",
        declareExternallyReferenced: declaresShared,
        ignoreMinAndMaxItems: plainArrays,
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
