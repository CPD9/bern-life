import { crossSite, jsonBody, requestUser } from "@/features/accounts/http";
import { failure } from "@/features/labs/http";
import { parseLab } from "@/features/labs/input";
import { createLab, labsOf } from "@/features/labs/store";
import { db } from "@/infrastructure/db";

export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  return Response.json({ labs: await labsOf(db(), user.id) });
}

/** Creates your lab (name, optional unit and description) with you as its lead. */
export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const lab = parseLab(await jsonBody(request));
  if (lab === null) return failure("bad_request");
  const created = await createLab(db(), user.id, lab, new Date());
  return created === "lab_exists"
    ? failure(created)
    : Response.json({ lab: created }, { status: 201 });
}
