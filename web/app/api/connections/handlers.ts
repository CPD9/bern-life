// Connections: ask a member to connect, answer or withdraw, and list your requests. A request and
// the notification it raises are written in one transaction; a withdrawn request takes its
// notifications with it, so nobody is left told about something that no longer waits.
import { isRequestId, parseAnswer, parseAsk } from "@/features/connections/input";
import {
  answerRequest,
  requestsOf,
  sendRequest,
  withdrawRequest,
} from "@/features/connections/store";
import { forgetAbout, markReadAbout, notifyUser } from "@/features/notifications/server-store";
import { type MemberRouteDeps, admittedFor, failure, jsonBody, signedInFor } from "../member-route";

export const CONNECTION_LIMITS = {
  ask: { key: "connections:ask", max: 20 },
  answer: { key: "connections:answer", max: 60 },
} as const;

export async function listRequests(request: Request, deps: MemberRouteDeps): Promise<Response> {
  const signedIn = await signedInFor(request, deps);
  if (!signedIn.ok) return signedIn.response;
  return Response.json({ requests: await requestsOf(deps.sql, signedIn.user.id) });
}

export async function askToConnect(request: Request, deps: MemberRouteDeps): Promise<Response> {
  const admitted = await admittedFor(request, deps, CONNECTION_LIMITS.ask);
  if (!admitted.ok) return admitted.response;
  const ask = parseAsk(await jsonBody(request));
  if (ask === null) return failure("bad_request");
  const { user, now } = admitted;
  const sent = await deps.sql.begin(async (tx) => {
    const outcome = await sendRequest(tx, user.id, ask, now);
    if (outcome.ok) {
      await forgetAbout(tx, "connection", outcome.id);
      await notifyUser(tx, outcome.to, "connection", outcome.id, now);
    }
    return outcome;
  });
  return sent.ok ? Response.json({ id: sent.id }, { status: 201 }) : failure(sent.error);
}

export async function answerConnection(
  request: Request,
  deps: MemberRouteDeps,
  id: string,
): Promise<Response> {
  const admitted = await admittedFor(request, deps, CONNECTION_LIMITS.answer);
  if (!admitted.ok) return admitted.response;
  const answer = parseAnswer(await jsonBody(request));
  if (answer === null) return failure("bad_request");
  if (!isRequestId(id)) return failure("not_found");
  const { user, now } = admitted;
  const done = await deps.sql.begin(async (tx) => {
    if (answer === "withdraw") {
      const to = await withdrawRequest(tx, user.id, id, now);
      if (to !== null) await forgetAbout(tx, "connection", id);
      return to !== null;
    }
    const from = await answerRequest(tx, user.id, id, answer, now);
    if (from === null) return false;
    await markReadAbout(tx, user.id, "connection", id, now);
    if (answer === "accept") await notifyUser(tx, from, "connection", id, now);
    return true;
  });
  return done ? new Response(null, { status: 204 }) : failure("not_found");
}
