import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type VisitApi, VisitSetting, visitApiOver } from "./visit-setting";

const plot = { district: "Länggasse" };

describe("VisitSetting", () => {
  test("a change keeps the stored plot and layout and is saved with the account", async () => {
    const saved: unknown[] = [];
    const api: VisitApi = {
      load: async () => ({
        status: "ready",
        handle: "bea",
        office: { plot, layout: null, visitVisibility: "private" },
      }),
      save: async (office) => {
        saved.push(office);
        return true;
      },
    };
    await act(async () => render(<VisitSetting api={api} />));
    const group = screen.getByRole("group", { name: "Who may visit your office" });
    expect((screen.getByLabelText("Only me") as HTMLInputElement).checked).toBe(true);
    await act(async () => fireEvent.click(screen.getByLabelText("Members")));
    expect(saved).toEqual([{ plot, layout: null, visitVisibility: "members" }]);
    expect((screen.getByLabelText("Members") as HTMLInputElement).checked).toBe(true);
    expect(group).toBeTruthy();
    expect(screen.getByText("Saved.")).toBeTruthy();
  });

  test("a stored Public is shown as Public, and the text says visitors must see your profile", async () => {
    const api: VisitApi = {
      load: async () => ({
        status: "ready",
        handle: "bea",
        office: { plot, layout: null, visitVisibility: "public" },
      }),
      save: async () => true,
    };
    await act(async () => render(<VisitSetting api={api} />));
    expect((screen.getByLabelText("Public") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Members") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText(/Members who can see your profile/)).toBeTruthy();
  });

  test("signed out there is nothing to choose", async () => {
    const api: VisitApi = { load: async () => ({ status: "signed-out" }), save: async () => true };
    await act(async () => render(<VisitSetting api={api} />));
    expect(screen.queryByRole("group", { name: "Who may visit your office" })).toBeNull();
  });

  test("it reads your own office by your handle, private when there is none yet", async () => {
    const sent: string[] = [];
    const api = visitApiOver(async (path, init) => {
      sent.push(`${init.method} ${path}`);
      if (path === "/api/auth/me") return Response.json({ user: { handle: "bea" } });
      return Response.json({ error: "not_found" }, { status: 404 });
    });
    expect(await api.load()).toEqual({
      status: "ready",
      handle: "bea",
      office: { plot: null, layout: null, visitVisibility: "private" },
    });
    expect(sent).toEqual(["GET /api/auth/me", "GET /api/people/bea/office"]);
  });
});
