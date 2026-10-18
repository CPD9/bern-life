import { requestUser } from "@/features/accounts/http";
import { failure } from "@/features/labs/http";
import { labFor } from "@/features/labs/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

/** The lab, its members and its linked public profiles, for its members only. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  const lab = isId(id) ? await labFor(db(), user.id, id) : null;
  return lab === null ? failure("not_found") : Response.json({ lab });
}
