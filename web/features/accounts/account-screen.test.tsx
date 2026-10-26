import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  FAILURE_TEXT,
  accountApiOver,
  type AccountApi,
  type AccountOutcome,
  type AccountUser,
  type JoinInput,
} from "./account-api";
import { StandaloneAccount } from "./account-screen";

const PETER: AccountUser = {
  id: "u-1",
  handle: "peter",
  displayName: "Peter Example",
  role: "member",
};

function fakeApi(
  overrides: Partial<AccountApi> = {},
): AccountApi & { deleted: string[]; joined: JoinInput[] } {
  const deleted: string[] = [];
  const joined: JoinInput[] = [];
  return {
    deleted,
    joined,
    me: async () => ({ ok: false, failure: "unauthenticated" }),
    join: async (input) => {
      joined.push(input);
      return { ok: true, value: PETER };
    },
    signIn: async () => ({ ok: true, value: PETER }),
    signOut: async () => {},
    deleteAccount: async (password) => {
      deleted.push(password);
      return { ok: true, value: null };
    },
    ...overrides,
  };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function press(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function shown(api: AccountApi) {
  await act(async () => {
    render(<StandaloneAccount api={api} />);
  });
}

describe("AccountScreen", () => {
  test("join with an invite, then sign out and delete the account", async () => {
    const api = fakeApi();
    await shown(api);
    type("Invite code", "K2VJ-67AV");
    type("Handle", "peter");
    type("Display name", "Peter Example");
    type("Password (at least 12 characters)", "demo password one");
    await press("Join Bern Life");
    expect(api.joined).toEqual([
      {
        invite: "K2VJ-67AV",
        handle: "peter",
        displayName: "Peter Example",
        password: "demo password one",
      },
    ]);
    expect(screen.getByRole("status").textContent).toBe("Signed in as Peter Example @peter");

    fireEvent.click(screen.getByText("Delete my account"));
    type("Your password, to confirm", "demo password one");
    await press("Delete everything");
    expect(api.deleted).toEqual(["demo password one"]);
    expect(screen.getByRole("button", { name: "Join with an invite" })).toBeTruthy();
  });

  test("each refusal is a sentence a person can act on", async () => {
    await shown(fakeApi({ join: async () => ({ ok: false, failure: "invite_invalid" }) }));
    type("Invite code", "NOPE");
    type("Handle", "peter");
    type("Display name", "Peter");
    type("Password (at least 12 characters)", "demo password one");
    await press("Join Bern Life");
    expect(screen.getByRole("alert").textContent).toBe(FAILURE_TEXT.invite_invalid);

    await press("Sign in");
    expect(screen.getByRole("form", { name: "Sign in" })).toBeTruthy();
  });

  test("a signed-in visitor sees the account at once and can sign out", async () => {
    const outcome: AccountOutcome<AccountUser> = { ok: true, value: PETER };
    await shown(fakeApi({ me: async () => outcome }));
    expect(screen.getByRole("status").textContent).toBe("Signed in as Peter Example @peter");
    await press("Sign out");
    expect(screen.getByRole("form", { name: "Join with an invite" })).toBeTruthy();
  });

  test("password fields say which password they hold, and no email is asked for", async () => {
    await shown(fakeApi());
    const join = screen.getByLabelText("Password (at least 12 characters)");
    expect([join.getAttribute("type"), join.getAttribute("autocomplete")]).toEqual([
      "password",
      "new-password",
    ]);
    expect(document.querySelector("input[type=email], input[name*=mail]")).toBeNull();
    await press("Sign in");
    const signIn = screen.getByLabelText("Password");
    expect(signIn.getAttribute("autocomplete")).toBe("current-password");
  });
});

describe("accountApiOver", () => {
  function answering(...responses: (Response | Error)[]) {
    const calls: [string, RequestInit][] = [];
    const api = accountApiOver(async (path, init) => {
      calls.push([path, init]);
      const next = responses.shift();
      if (next instanceof Error || next === undefined) throw next ?? new Error("no more responses");
      return next;
    });
    return { api, calls };
  }

  test("maps answers to outcomes: the user, a refusal marker, or network", async () => {
    const { api } = answering(
      Response.json({ user: PETER }),
      Response.json({ error: "rate_limited" }, { status: 429 }),
      new Error("offline"),
      new Response("<html>proxy error</html>", { status: 502 }),
    );
    const input = { handle: "peter", password: "x" };
    expect(await api.signIn(input)).toEqual({ ok: true, value: PETER });
    expect(await api.signIn(input)).toEqual({ ok: false, failure: "rate_limited" });
    expect(await api.me()).toEqual({ ok: false, failure: "network" });
    expect(await api.me()).toEqual({ ok: false, failure: "network" });
  });

  test("delete sends the password to DELETE /api/auth/me and succeeds on 204", async () => {
    const { api, calls } = answering(new Response(null, { status: 204 }));
    expect(await api.deleteAccount("demo password one")).toEqual({ ok: true, value: null });
    const [path, init] = calls[0] ?? [];
    expect([path, init?.method, init?.body]).toEqual([
      "/api/auth/me",
      "DELETE",
      '{"password":"demo password one"}',
    ]);
  });
});
