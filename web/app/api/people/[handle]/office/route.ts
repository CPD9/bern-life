import { requestUser } from "@/features/accounts/http";
import { failure } from "@/features/labs/http";
import { visibleOffice } from "@/features/people/store";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ handle: string }> };

/** A member's office, read-only, when their visit visibility allows it; your own always. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { handle } = await params;
  const user = await requestUser(request);
  const office = await visibleOffice(db(), user?.id ?? null, handle);
  return office === null ? failure("not_found") : Response.json({ office });
}
