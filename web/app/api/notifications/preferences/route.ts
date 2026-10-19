import { appMemberDeps } from "../../member-route";
import { getPreferences, putPreferences } from "../handlers";

/** Whether you get in-app notifications; on unless you turned them off. */
export function GET(request: Request): Promise<Response> {
  return getPreferences(request, appMemberDeps());
}

export function PUT(request: Request): Promise<Response> {
  return putPreferences(request, appMemberDeps());
}
