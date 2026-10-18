// The labs and people routes' error markers. Not a member and not there look the same (404), so
// a lab's existence is never revealed to someone outside it.
type Marker =
  | "bad_request"
  | "invite_invalid"
  | "unauthenticated"
  | "not_lead"
  | "not_found"
  | "unknown_profile"
  | "lab_exists"
  | "lead_cannot_leave";

const STATUS: Record<Marker, number> = {
  bad_request: 400,
  invite_invalid: 400,
  unauthenticated: 401,
  not_lead: 403,
  not_found: 404,
  unknown_profile: 404,
  lab_exists: 409,
  lead_cannot_leave: 409,
};

export function failure(marker: Marker): Response {
  return Response.json({ error: marker }, { status: STATUS[marker] });
}

export function done(): Response {
  return new Response(null, { status: 204 });
}
