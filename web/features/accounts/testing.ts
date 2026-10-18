// The throwaway database the database tests run against. Tests empty the account tables, so a
// database whose name is not a throwaway one is refused, the same rule as make db-reset-throwaway.
import postgres from "postgres";
import type { Sql } from "@/infrastructure/db";
import { testDatabaseUrl } from "@/infrastructure/env";

const THROWAWAY = /^bernlife_(l[123]|ci)$/;

function throwawayUrl(): string | null {
  const url = testDatabaseUrl();
  if (url === null || !URL.canParse(url)) return null;
  return THROWAWAY.test(new URL(url).pathname.slice(1)) ? url : null;
}

const url = throwawayUrl();

export const testDb: Sql | null =
  url === null ? null : postgres(url, { max: 2, onnotice: () => {} });

export const SKIPPED =
  "database tests need DATABASE_URL pointing at a migrated throwaway database (bernlife_l1..l3 or bernlife_ci)";

export async function emptyAccounts(sql: Sql): Promise<void> {
  await sql`truncate app_user, invite, rate_limit cascade`;
}
