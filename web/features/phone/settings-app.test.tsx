import { afterEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { applySettings, defaultSettings, settingsKey } from "@/infrastructure/settings";
import { type Fetch, profileApiOver } from "./profile-api";
import { SettingsApp } from "./settings-app";

afterEach(() => {
  localStorage.removeItem(settingsKey);
});

type Sent = { path: string; method: string; body: string | undefined };

function fakeServer(
  me: { status: number; body?: unknown },
  put: () => Promise<Response> = async () => new Response(null, { status: 204 }),
) {
  const sent: Sent[] = [];
  const send: Fetch = async (path, init) => {
    sent.push({ path, method: init.method ?? "GET", body: init.body as string | undefined });
    if (path === "/api/auth/me/profile") return put();
    return Response.json(me.body ?? { error: "unauthenticated" }, { status: me.status });
  };
  return { api: profileApiOver(send), sent };
}

const checked = (group: HTMLElement, label: string) =>
  (within(group).getByLabelText(label) as HTMLInputElement).checked;

const member = {
  user: { id: "u1", handle: "demo_lea", displayName: "Demo Lea" },
  profile: {
    role: "researcher",
    goal: "find-people",
    expertise: ["wound healing"],
    visibility: "private",
    avatar: { colour: "teal" },
    updatedAt: "2026-10-18T10:00:00Z",
  },
};

describe("Settings", () => {
  // The settings store is one per page, so this test starts from whatever an earlier test left
  // and checks each change against the state before it.
  test("night mode and lite graphics write their attributes on <html> and are saved", async () => {
    const { api } = fakeServer({ status: 401 });
    await act(async () => render(<SettingsApp profileApi={api} />));
    const night = screen.getByRole("group", { name: "Night mode" });
    const lite = screen.getByRole("switch", { name: "Lite graphics" });
    const root = document.documentElement;
    try {
      fireEvent.click(within(night).getByLabelText("Off"));
      expect(root.getAttribute("data-theme")).toBe("day");
      fireEvent.click(within(night).getByLabelText("On"));
      expect(root.getAttribute("data-theme")).toBe("night");
      const before = lite.getAttribute("aria-checked") === "true";
      fireEvent.click(lite);
      expect(lite.getAttribute("aria-checked")).toBe(String(!before));
      expect(root.getAttribute("data-graphics")).toBe(before ? null : "lite");
      fireEvent.click(lite);
      expect(lite.getAttribute("aria-checked")).toBe(String(before));
      expect(root.getAttribute("data-graphics")).toBe(before ? "lite" : null);
      expect(JSON.parse(localStorage.getItem(settingsKey)!)).toEqual({ night: "on", lite: before });
    } finally {
      fireEvent.click(within(night).getByLabelText("Auto"));
      if (lite.getAttribute("aria-checked") === "true") fireEvent.click(lite);
      applySettings(root, defaultSettings);
    }
  });

  test("there is no data saver any more", async () => {
    const { api } = fakeServer({ status: 401 });
    await act(async () => render(<SettingsApp profileApi={api} />));
    expect(screen.queryByText(/data saver/i)).toBeNull();
  });

  test("push and email are off, disabled and say they are not available yet", async () => {
    const { api } = fakeServer({ status: 401 });
    await act(async () => render(<SettingsApp profileApi={api} />));
    const inApp = screen.getByRole("switch", { name: "In the app" });
    expect(inApp.getAttribute("aria-checked")).toBe("true");
    for (const name of ["Push", "Email"]) {
      const toggle = screen.getByRole("switch", { name }) as HTMLButtonElement;
      expect(toggle.getAttribute("aria-checked")).toBe("false");
      expect(toggle.disabled).toBe(true);
      expect(toggle.getAttribute("aria-describedby")).not.toBeNull();
      const description = document.getElementById(toggle.getAttribute("aria-describedby")!);
      expect(description!.textContent).toBe("Not available yet.");
    }
  });

  test("signed out, it says so and links to sign in", async () => {
    const { api } = fakeServer({ status: 401 });
    await act(async () => render(<SettingsApp profileApi={api} />));
    expect(screen.getByText(/You are not signed in/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/account");
  });

  test("changing visibility PUTs the stored profile with only visibility changed", async () => {
    const { api, sent } = fakeServer({ status: 200, body: member });
    await act(async () => render(<SettingsApp profileApi={api} />));
    const group = screen.getByRole("group", { name: "Who sees your profile" });
    expect(checked(group, "Only me")).toBe(true);
    await act(async () => fireEvent.click(within(group).getByLabelText("Members")));
    expect(sent.at(-1)).toEqual({
      path: "/api/auth/me/profile",
      method: "PUT",
      body: '{"role":"researcher","goal":"find-people","expertise":["wound healing"],"visibility":"members","avatar":{"colour":"teal"}}',
    });
    expect(checked(group, "Members")).toBe(true);
    expect(screen.getByText("Saved.")).toBeTruthy();
  });

  test("a failed save keeps the stored choice, says so, and focus stays on the choice", async () => {
    const { api } = fakeServer({ status: 200, body: member }, async () =>
      Response.json({ error: "internal" }, { status: 500 }),
    );
    await act(async () => render(<SettingsApp profileApi={api} />));
    const group = screen.getByRole("group", { name: "Who sees your profile" });
    const members = within(group).getByLabelText("Members");
    members.focus();
    await act(async () => fireEvent.click(members));
    expect(checked(group, "Only me")).toBe(true);
    expect(checked(group, "Members")).toBe(false);
    expect(screen.getByText("Not saved. Try again in a moment.")).toBeTruthy();
    expect(document.activeElement).toBe(members);
  });

  test("while a save is out, the group is busy and a second change is ignored", async () => {
    let finish: (response: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => (finish = resolve));
    const { api, sent } = fakeServer({ status: 200, body: member }, () => held);
    await act(async () => render(<SettingsApp profileApi={api} />));
    const group = screen.getByRole("group", { name: "Who sees your profile" });
    await act(async () => fireEvent.click(within(group).getByLabelText("Members")));
    expect(group.getAttribute("aria-busy")).toBe("true");
    expect(group.hasAttribute("disabled")).toBe(false);
    await act(async () => fireEvent.click(within(group).getByLabelText("Only me")));
    await act(async () => finish(new Response(null, { status: 204 })));
    const puts = sent.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0]!.body!).visibility).toBe("members");
    expect(checked(group, "Members")).toBe(true);
    expect(group.getAttribute("aria-busy")).toBe("false");
  });

  const engine = (mode: "live" | "replay" | "mock", snapshot: string) =>
    ({
      status: "ok",
      health: { mode, snapshot, counts: { pages: 1234, sources: 3 } },
    }) as const;

  test("about shows the snapshot and counts health gives", async () => {
    const { api } = fakeServer({ status: 401 });
    await act(async () =>
      render(<SettingsApp profileApi={api} health={engine("live", "2026-10-18")} />),
    );
    const terms = Array.from(document.querySelectorAll("dt, dd")).map((node) => node.textContent);
    expect(terms).toEqual(["Snapshot", "2026-10-18", "Pages", "1,234", "Sources", "3"]);
    expect(
      screen.getByText(
        "Live: a model widens your question and explains results from the claims they cite.",
      ),
    ).toBeTruthy();
  });

  test("a real engine without a model is plain search; only the fixture is MOCK", async () => {
    const { api } = fakeServer({ status: 401 });
    const plain =
      "Plain search: no model is connected, so the stored pages are searched as they are.";
    const fixture = "MOCK: fixture data. No model answered, and results are canned test data.";
    const { rerender } = await act(async () =>
      render(<SettingsApp profileApi={api} health={engine("mock", "2026-10-18")} />),
    );
    expect(screen.getByText(plain)).toBeTruthy();
    expect(screen.queryByText(fixture)).toBeNull();
    rerender(<SettingsApp profileApi={api} health={engine("mock", "fixture")} />);
    expect(screen.getByText(fixture)).toBeTruthy();
    rerender(<SettingsApp profileApi={api} health={engine("mock", "2026-10-18")} fixtureMode />);
    expect(screen.getByText(fixture)).toBeTruthy();
  });
});
