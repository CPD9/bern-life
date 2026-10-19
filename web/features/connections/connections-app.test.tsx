import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ConnectionsApp } from "./connections-app";
import {
  type ConnectionsApi,
  FAILURE_TEXT,
  type Member,
  connectionsApiOver,
} from "./connections-api";
import type { Answer } from "./input";
import type { ConnectionView } from "./types";
import { useConnections } from "./use-connections";

const BEA: Member = {
  handle: "bea",
  displayName: "Bea Example",
  role: "researcher",
  canVisit: false,
};
const CEM: Member = { handle: "cem", displayName: "Cem Example", role: null, canVisit: true };
const DEMO: Member = {
  handle: "demo-lena",
  displayName: "Lena Beispiel",
  role: "company",
  canVisit: true,
  demo: true,
};

function request(
  id: string,
  person: Member,
  status: ConnectionView["status"],
  direction: ConnectionView["direction"],
): ConnectionView {
  return {
    id,
    person: { handle: person.handle, displayName: person.displayName },
    status,
    direction,
    note: direction === "incoming" ? "Shall we talk about sensors?" : null,
    createdAt: "2026-10-19T08:00:00.000Z",
    respondedAt: null,
    unread: false,
  };
}

/** An in-memory server: the directory, your requests, and what was asked of it. */
function fakeServer({ signedIn = true, requests = [] as ConnectionView[], askFails = false } = {}) {
  const held = [...requests];
  const asked: { handle: string; note: string }[] = [];
  const answered: { id: string; answer: Answer }[] = [];
  const visited: string[] = [];
  const api: ConnectionsApi = {
    people: async () => ({ ok: true, value: [BEA, CEM, DEMO] }),
    requests: async () =>
      signedIn ? { ok: true, value: [...held] } : { ok: false, failure: "unauthenticated" },
    ask: async (handle, note) => {
      asked.push({ handle, note });
      if (askFails) return { ok: false, failure: "request_exists" };
      const member = [BEA, CEM].find((m) => m.handle === handle) as Member;
      held.unshift(request(`r-${handle}`, member, "pending", "outgoing"));
      return { ok: true, value: `r-${handle}` };
    },
    answer: async (id, answer) => {
      answered.push({ id, answer });
      const index = held.findIndex((r) => r.id === id);
      const current = held[index] as ConnectionView;
      const status = answer === "accept" ? "accepted" : answer === "decline" ? "declined" : null;
      if (status === null) held.splice(index, 1);
      else held[index] = { ...current, status };
      return { ok: true, value: null };
    },
    office: async (handle) => {
      visited.push(handle);
      return handle === "cem" ? { ok: false, failure: "not_found" } : { ok: true, value: null };
    },
  };
  return { api, asked, answered, visited };
}

function Harness({
  api,
  onMessage,
  onConnected,
}: {
  api: ConnectionsApi;
  onMessage: (h: string) => void;
  onConnected?: () => void;
}) {
  const controller = useConnections(api, onConnected ? { onConnected } : {});
  return (
    <ConnectionsApp
      controller={controller}
      api={api}
      onMessage={onMessage}
      renderRoom={(name) => <p>Room of {name}</p>}
    />
  );
}

async function shown(api: ConnectionsApi, extra: { onConnected?: () => void } = {}) {
  const messaged: string[] = [];
  await act(async () => {
    render(<Harness api={api} onMessage={(handle) => messaged.push(handle)} {...extra} />);
  });
  return messaged;
}

async function click(name: string | RegExp, scope: HTMLElement = document.body) {
  await act(async () => {
    fireEvent.click(within(scope).getByRole("button", { name }));
  });
}

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("ConnectionsApp", () => {
  test("signed out, members show with DEMO labelled, and only visits are offered", async () => {
    await shown(fakeServer({ signedIn: false }).api);
    expect(screen.getByRole("link", { name: "Sign in or join" }).getAttribute("href")).toBe(
      "/account",
    );
    expect(row("Lena Beispiel").textContent).toContain("DEMO");
    expect(row("Lena Beispiel").textContent).toContain(
      "Invented for the demo: no messages or requests.",
    );
    expect(screen.queryByRole("button", { name: /^Message/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Connect/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Visit office of/ }).length).toBe(2);
    expect(screen.queryByText("Your connections")).toBeNull();
  });

  test("Connect sends a note with the request, then offers to withdraw", async () => {
    const server = fakeServer();
    await shown(server.api);
    await click("Connect with Bea Example", row("Bea Example"));
    const note = screen.getByLabelText("A note for Bea Example (optional)");
    expect(document.activeElement).toBe(note);
    expect(note.getAttribute("maxlength")).toBe("280");
    fireEvent.change(note, { target: { value: "Glucose sensors?" } });
    expect(screen.getByText("16 of 280 characters")).toBeTruthy();
    await click("Send request");
    expect(server.asked).toEqual([{ handle: "bea", note: "Glucose sensors?" }]);
    expect(row("Bea Example").textContent).toContain("Request sent");
    expect(document.activeElement).toBe(screen.getByText("Request sent to Bea Example."));
    await click("Withdraw your request to Bea Example", row("Bea Example"));
    expect(server.answered).toEqual([{ id: "r-bea", answer: "withdraw" }]);
    expect(
      within(row("Bea Example")).getByRole("button", { name: "Connect with Bea Example" }),
    ).toBeTruthy();
  });

  test("accepting a request connects you once, and Message opens the thread by handle", async () => {
    const server = fakeServer({ requests: [request("r1", CEM, "pending", "incoming")] });
    let connected = 0;
    const messaged = await shown(server.api, { onConnected: () => (connected += 1) });
    const asking = screen.getByRole("heading", { name: "Asking to connect" })
      .parentElement as HTMLElement;
    expect(asking.textContent).toContain("Shall we talk about sensors?");
    expect(
      within(asking).getByRole("button", { name: "Decline Cem Example's request" }),
    ).toBeTruthy();
    await click("Accept Cem Example's request", asking);
    expect(server.answered).toEqual([{ id: "r1", answer: "accept" }]);
    expect(connected).toBe(1);
    expect(screen.queryByRole("heading", { name: "Asking to connect" })).toBeNull();
    const yours = screen.getByRole("heading", { name: "Your connections" })
      .parentElement as HTMLElement;
    await click("Message Cem Example", yours);
    expect(messaged).toEqual(["cem"]);
    expect(yours.textContent).toContain("Cem Example @cem");
  });

  test("a visit asks the server first: an open office shows its room, a closed one says so", async () => {
    const server = fakeServer();
    await shown(server.api);
    await click("Visit office of Lena Beispiel");
    expect(screen.getByRole("dialog", { name: "Lena Beispiel's office" }).textContent).toContain(
      "Room of Lena Beispiel",
    );
    expect(screen.getByText(/^DEMO: an invented member's office/)).toBeTruthy();
    await click("Close");
    await click("Visit office of Cem Example");
    expect(screen.getByText("This office is not open to you.")).toBeTruthy();
    expect(screen.queryByText("Room of Cem Example")).toBeNull();
    expect(server.visited).toEqual(["demo-lena", "cem"]);
  });

  test("Cancel closes the note and gives focus back to Connect", async () => {
    const server = fakeServer();
    await shown(server.api);
    await click("Connect with Bea Example", row("Bea Example"));
    await click("Cancel");
    expect(document.activeElement).toBe(
      within(row("Bea Example")).getByRole("button", { name: "Connect with Bea Example" }),
    );
    expect(server.asked).toEqual([]);
  });

  test("a refused request says why in plain words", async () => {
    await shown(fakeServer({ askFails: true }).api);
    await click("Connect with Bea Example", row("Bea Example"));
    await click("Send request");
    expect(screen.getByRole("alert").textContent).toBe(FAILURE_TEXT.request_exists);
  });
});

describe("connectionsApiOver", () => {
  test("puts only the handle in paths and maps error markers", async () => {
    const sent: { path: string; init: RequestInit }[] = [];
    const api = connectionsApiOver(async (path, init) => {
      sent.push({ path, init });
      return path === "/api/connections"
        ? Response.json({ error: "connected" }, { status: 409 })
        : Response.json({ error: "teapot" }, { status: 418 });
    });
    expect(await api.ask("bea", "Hello")).toEqual({ ok: false, failure: "connected" });
    expect(await api.office("bea")).toEqual({ ok: false, failure: "network" });
    expect(sent.map((s) => [s.path, s.init.method, s.init.body ?? null])).toEqual([
      ["/api/connections", "POST", '{"handle":"bea","note":"Hello"}'],
      ["/api/people/bea/office", "GET", null],
    ]);
  });
});
