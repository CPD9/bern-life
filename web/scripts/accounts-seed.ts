// `bun run accounts:seed`: creates the team's accounts, an `admin` account and ten test accounts,
// without invites, and prints each new handle with its password once. Redirect the output into a
// file only you can read; never commit it or paste it. Handles that exist are skipped and keep
// their passwords, but take the role this list gives them, so an `admin` seeded before roles
// existed becomes an admin too. Only `admin` has that role: it sees the Admin app on the desk.
import { seedAccount } from "@/features/accounts/accounts";
import { type UserRole, setRole } from "@/features/accounts/store";
import { db } from "@/infrastructure/db";

const TEAM: readonly (readonly [string, string, UserRole])[] = [
  ["peter", "Peter", "member"],
  ["yaseen", "Yaseen", "member"],
  ["nik", "Nik", "member"],
  ["admin", "Admin", "admin"],
];
const TESTS = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [`test${n}`, `Test ${n}`, "member"] as const;
});

const lines: string[] = [];
for (const [handle, displayName, role] of [...TEAM, ...TESTS]) {
  const seeded = await seedAccount(db(), handle, displayName, role);
  if (seeded === "exists") await setRole(db(), handle, role);
  lines.push(
    seeded === "exists"
      ? `${handle}\t(exists, password kept, role ${role})`
      : `${handle}\t${seeded.password}`,
  );
}
console.log(`handle\tpassword\n${lines.join("\n")}`);
await db().end();
