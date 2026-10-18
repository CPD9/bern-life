// The messages routes' shared edges. Not a member and not there look the same (404), so a
// conversation's existence is never revealed to someone outside it.
type Marker = "bad_request" | "unauthenticated" | "not_found" | "unknown_handle";

const STATUS: Record<Marker, number> = {
  bad_request: 400,
  unauthenticated: 401,
  not_found: 404,
  unknown_handle: 404,
};

export function failure(marker: Marker): Response {
  return Response.json({ error: marker }, { status: STATUS[marker] });
}

export function done(): Response {
  return new Response(null, { status: 204 });
}
