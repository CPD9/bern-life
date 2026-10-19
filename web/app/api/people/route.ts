import { env } from "@/infrastructure/env";
import { appMemberDeps } from "../member-route";
import { listPeople } from "./handlers";

/** Members whose profile you may see: `public` for anyone, `members` for signed-in viewers. */
export async function GET(request: Request): Promise<Response> {
  return listPeople(request, { ...appMemberDeps(), demoFixtures: env().demoFixtures });
}
