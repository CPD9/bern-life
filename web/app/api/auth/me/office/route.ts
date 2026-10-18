import { crossSite, failure, jsonBody, requestUser } from "@/features/accounts/http";
import { parseOffice } from "@/features/people/office";
import { saveOffice } from "@/features/people/store";
import { db } from "@/infrastructure/db";

/** Saves your office plot, layout and visit visibility (all three; private by default). */
export async function PUT(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const office = parseOffice(await jsonBody(request));
  if (office === null) return failure("bad_request");
  await saveOffice(db(), user.id, office, new Date());
  return new Response(null, { status: 204 });
}
