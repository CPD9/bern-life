// Where you stand with each member, from your requests: pure, so the app and the tests read the
// same answer. A withdrawn request is never listed by the server, so it is the same as none.
import type { ConnectionView, Person } from "./types";

export type Relation =
  | { kind: "none" }
  | { kind: "connected" }
  | { kind: "you-asked"; id: string }
  | { kind: "asks-you"; id: string; note: string | null }
  | { kind: "they-declined" }
  | { kind: "you-declined" };

export function relationTo(handle: string, requests: readonly ConnectionView[]): Relation {
  const request = requests.find((candidate) => candidate.person.handle === handle);
  if (request === undefined) return { kind: "none" };
  const outgoing = request.direction === "outgoing";
  if (request.status === "accepted") return { kind: "connected" };
  if (request.status === "pending") {
    return outgoing
      ? { kind: "you-asked", id: request.id }
      : { kind: "asks-you", id: request.id, note: request.note };
  }
  if (request.status === "declined") return { kind: outgoing ? "they-declined" : "you-declined" };
  return { kind: "none" };
}

/** Accepted connections, by name. */
export function connectedPeople(requests: readonly ConnectionView[]): Person[] {
  return requests
    .filter((request) => request.status === "accepted")
    .map((request) => request.person)
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.handle.localeCompare(b.handle));
}

/** Requests waiting for your answer, newest first as the server sends them. */
export function waitingForYou(requests: readonly ConnectionView[]): ConnectionView[] {
  return requests.filter((r) => r.status === "pending" && r.direction === "incoming");
}

/** True when `after` holds an accepted connection that `before` did not. */
export function gainedConnection(
  before: readonly ConnectionView[],
  after: readonly ConnectionView[],
): boolean {
  const had = new Set(before.filter((r) => r.status === "accepted").map((r) => r.id));
  return after.some((r) => r.status === "accepted" && !had.has(r.id));
}
