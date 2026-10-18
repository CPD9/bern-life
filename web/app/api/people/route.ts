import { requestUser } from "@/features/accounts/http";
import { directory } from "@/features/people/store";
import { db } from "@/infrastructure/db";

/** Members who allow visits: `public` for anyone, `members` for signed-in viewers, and you. */
export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  return Response.json({ people: await directory(db(), user?.id ?? null) });
}
