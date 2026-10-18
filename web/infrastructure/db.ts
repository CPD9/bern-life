// One connection pool per server process, opened on first use. Queries use postgres' tagged
// templates, so every value is a bound parameter and never part of the SQL text.
import postgres from "postgres";
import { accountsEnv } from "./env";

export type Sql = postgres.Sql;
export type Db = postgres.Sql | postgres.TransactionSql;

let pool: Sql | undefined;

export function db(): Sql {
  pool ??= postgres(accountsEnv().databaseUrl, { max: 5, onnotice: () => {} });
  return pool;
}
