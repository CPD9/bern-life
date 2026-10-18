import { crossSite, requestUser } from "@/features/accounts/http";
import { failure } from "@/features/labs/http";
import { createLabInvite } from "@/features/labs/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

/** A one-time invite code for the lab; only its lead can make one. The code is shown once. */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  const invite = await createLabInvite(db(), user.id, id, new Date());
  return invite === "not_lead" ? failure(invite) : Response.json(invite, { status: 201 });
}
