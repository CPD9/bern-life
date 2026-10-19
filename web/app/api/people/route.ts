import { env } from "@/infrastructure/env";
import { appMemberDeps, withoutAccounts } from "../member-route";
import { demoPeople, listPeople } from "./handlers";

/** Members whose profile you may see: `public` for anyone, `members` for signed-in viewers. */
export async function GET(request: Request): Promise<Response> {
  if (withoutAccounts()) return demoPeople();
  return listPeople(request, { ...appMemberDeps(), demoFixtures: env().demoFixtures });
}
