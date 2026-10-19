import { afterEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { applySettings, defaultSettings, settingsKey } from "@/infrastructure/settings";
import { type Fetch, profileApiOver } from "./profile-api";
import { SettingsApp } from "./settings-app";

afterEach(() => {
  localStorage.removeItem(settingsKey);
});

type Sent = { path: string; method: string; body: string | undefined };

function fakeServer(me: { status: number; body?: unknown }) {
  const sent: Sent[] = [];
  const send: Fetch = async (path, init) => {
    sent.push({ path, method: init.method ?? "GET", body: init.body as string | undefined });
    if (path === "/api/auth/me/profile") return new Response(null, { status: 204 });
    return Response.json(me.body ?? { error: "unauthenticated" }, { status: me.status });
  };
  return { api: profileApiOver(send), sent };
}

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
  test("night mode and lite graphics write their attributes on <html> and are saved", async () => {
    const { api } = fakeServer({ status: 401 });
    await act(async () => render(<SettingsApp profileApi={api} />));
    fireEvent.click(within(screen.getByRole("group", { name: "Night mode" })).getByLabelText("On"));
    fireEvent.click(screen.getByRole("switch", { name: "Lite graphics" }));
    const root = document.documentElement;
    try {
      expect(root.getAttribute("data-theme")).toBe("night");
      expect(root.getAttribute("data-graphics")).toBe("lite");
      expect(JSON.parse(localStorage.getItem(settingsKey)!)).toEqual({ night: "on", lite: true });
    } finally {
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
    expect((within(group).getByLabelText("Only me") as HTMLInputElement).checked).toBe(true);
    await act(async () => fireEvent.click(within(group).getByLabelText("Members")));
    expect(sent.at(-1)).toEqual({
      path: "/api/auth/me/profile",
      method: "PUT",
      body: '{"role":"researcher","goal":"find-people","expertise":["wound healing"],"visibility":"members","avatar":{"colour":"teal"}}',
    });
    expect((within(group).getByLabelText("Members") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Saved.")).toBeTruthy();
  });

  test("about shows the snapshot and counts health gives, and MOCK plainly", async () => {
    const { api } = fakeServer({ status: 401 });
    const health = {
      status: "ok",
      health: { mode: "mock", snapshot: "2026-10-18", counts: { pages: 1234, sources: 3 } },
    } as const;
    await act(async () => render(<SettingsApp profileApi={api} health={health} />));
    const terms = Array.from(document.querySelectorAll("dt, dd")).map((node) => node.textContent);
    expect(terms).toEqual(["Snapshot", "2026-10-18", "Pages", "1,234", "Sources", "3"]);
    expect(
      screen.getByText("MOCK: no model is connected, so answers are fixed examples."),
    ).toBeTruthy();
  });
});
