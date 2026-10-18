// `bun run invite:create [--count N]`: mints invite codes and prints each one once. Only their
// SHA-256 is stored, so a lost code is replaced, never recovered.
import { createInvites, INVITE_DAYS } from "@/features/accounts/accounts";
import { db } from "@/infrastructure/db";

const MAX = 10;
const flag = process.argv.indexOf("--count");
const count = flag === -1 ? 1 : Number(process.argv[flag + 1]);

if (!Number.isInteger(count) || count < 1 || count > MAX) {
  console.error(`usage: bun run invite:create [--count 1..${MAX}]`);
  process.exit(2);
}

const codes = await createInvites(db(), count, new Date(), null);
console.log(
  `${count} invite code(s), each valid once for ${INVITE_DAYS} days:\n${codes.join("\n")}`,
);
await db().end();
