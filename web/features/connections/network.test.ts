import { describe, expect, test } from "bun:test";
import { connectedPeople, gainedConnection, relationTo, waitingForYou } from "./network";
import type { ConnectionView } from "./types";

function request(
  id: string,
  handle: string,
  status: ConnectionView["status"],
  direction: ConnectionView["direction"],
): ConnectionView {
  return {
    id,
    person: { handle, displayName: handle.toUpperCase() },
    status,
    direction,
    note: direction === "incoming" ? "Hello" : null,
    createdAt: "2026-10-19T08:00:00.000Z",
    respondedAt: null,
  };
}

const requests = [
  request("r1", "bea", "pending", "outgoing"),
  request("r2", "cem", "pending", "incoming"),
  request("r3", "dan", "declined", "outgoing"),
  request("r4", "eva", "declined", "incoming"),
  request("r5", "zoe", "accepted", "incoming"),
  request("r6", "abe", "accepted", "outgoing"),
];

describe("network", () => {
  test("where you stand with each member follows the request and its direction", () => {
    expect(
      ["bea", "cem", "dan", "eva", "zoe", "nobody"].map((h) => relationTo(h, requests)),
    ).toEqual([
      { kind: "you-asked", id: "r1" },
      { kind: "asks-you", id: "r2", note: "Hello" },
      { kind: "they-declined" },
      { kind: "you-declined" },
      { kind: "connected" },
      { kind: "none" },
    ]);
  });

  test("connections are accepted requests by name; waiting ones are incoming and pending", () => {
    expect(connectedPeople(requests).map((p) => p.handle)).toEqual(["abe", "zoe"]);
    expect(waitingForYou(requests).map((r) => r.id)).toEqual(["r2"]);
  });

  test("a gained connection is one accepted now that was not before", () => {
    const accepted = requests.map((r) =>
      r.id === "r1" ? { ...r, status: "accepted" as const } : r,
    );
    expect([gainedConnection(requests, accepted), gainedConnection(accepted, accepted)]).toEqual([
      true,
      false,
    ]);
  });
});
