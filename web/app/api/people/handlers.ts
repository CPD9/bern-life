// The member directory and office visits. Under DEMO_FIXTURES the invented demo members are listed
// after the real ones and marked `demo`; without it they do not exist. A demo member's office can
// be visited there, and only there. Under DEMO_FIXTURES with no database there are no accounts at
// all, and the demo members are the whole directory.
import { DEMO_MEMBERS, demoOffice } from "@/features/people/demo-members";
import { directory, visibleOffice } from "@/features/people/store";
import { type MemberRouteDeps, failure } from "../member-route";

export type PeopleDeps = MemberRouteDeps & { readonly demoFixtures: boolean };

/** Members whose profile you may see (never you), each saying whether you may visit their office. */
export async function listPeople(request: Request, deps: PeopleDeps): Promise<Response> {
  const viewer = await deps.userOf(request, deps.now());
  const people = await directory(deps.sql, viewer?.id ?? null);
  return Response.json({ people: deps.demoFixtures ? [...people, ...DEMO_MEMBERS] : people });
}

/** A member's office, read-only, when their visit visibility allows it; your own always. */
export async function officeOf(
  request: Request,
  deps: PeopleDeps,
  handle: string,
): Promise<Response> {
  if (deps.demoFixtures && demoOffice(handle) !== null) return demoOfficeOf(handle);
  const viewer = await deps.userOf(request, deps.now());
  const office = await visibleOffice(deps.sql, viewer?.id ?? null, handle);
  return office === null ? failure("not_found") : Response.json({ office });
}

/** The directory under DEMO_FIXTURES with no database: the demo members alone. */
export function demoPeople(): Response {
  return Response.json({ people: DEMO_MEMBERS });
}

/** A demo member's office under DEMO_FIXTURES; any other handle is not there. */
export function demoOfficeOf(handle: string): Response {
  const office = demoOffice(handle);
  return office === null ? failure("not_found") : Response.json({ office });
}
