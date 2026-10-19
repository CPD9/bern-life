// `bun run accounts:seed`: creates the team's accounts, an `admin` account and ten test accounts,
// without invites, and prints each new handle with its password once. Redirect the output into a
// file only you can read; never commit it or paste it. Handles that exist are skipped and keep
// their passwords. `admin` is an ordinary account: the app has no admin rights.
import { seedAccount } from "@/features/accounts/accounts";
import { db } from "@/infrastructure/db";

const TEAM = [
  ["peter", "Peter"],
  ["yaseen", "Yaseen"],
  ["nik", "Nik"],
  ["admin", "Admin"],
] as const;
const TESTS = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [`test${n}`, `Test ${n}`] as const;
});

const lines: string[] = [];
for (const [handle, displayName] of [...TEAM, ...TESTS]) {
  const seeded = await seedAccount(db(), handle, displayName);
  lines.push(
    seeded === "exists" ? `${handle}\t(exists, unchanged)` : `${handle}\t${seeded.password}`,
  );
}
console.log(`handle\tpassword\n${lines.join("\n")}`);
await db().end();
