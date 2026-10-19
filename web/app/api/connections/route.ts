import { appMemberDeps } from "../member-route";
import { askToConnect, listRequests } from "./handlers";

/** Every connection request you sent or received, newest first. */
export function GET(request: Request): Promise<Response> {
  return listRequests(request, appMemberDeps());
}

/** Asks a member to connect, by handle, with an optional note of up to 280 characters. */
export function POST(request: Request): Promise<Response> {
  return askToConnect(request, appMemberDeps());
}
