import { appMemberDeps } from "../../member-route";
import { answerConnection } from "../handlers";

type Context = { params: Promise<{ id: string }> };

/** Accept or decline a request you received, or withdraw one you sent, while it waits. */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  return answerConnection(request, appMemberDeps(), id);
}
