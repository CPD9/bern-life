import { env } from "@/infrastructure/env";
import { appMemberDeps } from "../../../member-route";
import { officeOf } from "../../handlers";

type Context = { params: Promise<{ handle: string }> };

/** A member's office, read-only, when their visit visibility allows it; your own always. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { handle } = await params;
  return officeOf(request, { ...appMemberDeps(), demoFixtures: env().demoFixtures }, handle);
}
