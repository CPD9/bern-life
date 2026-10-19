import { appMemberDeps, failure, withoutAccounts } from "../member-route";
import { askToConnect, listRequests } from "./handlers";

/** Every connection request you sent or received, newest first. */
export async function GET(request: Request): Promise<Response> {
  if (withoutAccounts()) return failure("unauthenticated");
  return listRequests(request, appMemberDeps());
}

/** Asks a member to connect, by handle, with an optional note of up to 280 characters. */
export function POST(request: Request): Promise<Response> {
  return askToConnect(request, appMemberDeps());
}
