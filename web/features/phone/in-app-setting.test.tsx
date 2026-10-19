import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type InAppApi, InAppSetting, inAppApiOver } from "./in-app-setting";

function fakeApi(load: Awaited<ReturnType<InAppApi["load"]>>, saves = true) {
  const saved: boolean[] = [];
  const api: InAppApi = {
    load: async () => load,
    save: async (on) => {
      saved.push(on);
      return saves;
    },
  };
  return { api, saved };
}

const toggle = () => screen.getByRole("switch", { name: "In the app" }) as HTMLButtonElement;

describe("InAppSetting", () => {
  test("signed in, turning it off is saved with the account", async () => {
    const { api, saved } = fakeApi(true);
    await act(async () => render(<InAppSetting api={api} />));
    expect([toggle().getAttribute("aria-checked"), toggle().disabled]).toEqual(["true", false]);
    await act(async () => fireEvent.click(toggle()));
    expect(saved).toEqual([false]);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Saved.")).toBeTruthy();
  });

  test("a failed save keeps the choice as it was and says so", async () => {
    const { api } = fakeApi(true, false);
    await act(async () => render(<InAppSetting api={api} />));
    await act(async () => fireEvent.click(toggle()));
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Not saved. Try again in a moment.")).toBeTruthy();
  });

  test("signed out, it stays on and cannot be changed", async () => {
    await act(async () => render(<InAppSetting api={fakeApi("signed-out").api} />));
    expect([toggle().getAttribute("aria-checked"), toggle().disabled]).toEqual(["true", true]);
    expect(screen.getByText(/Messages and requests need an account/)).toBeTruthy();
  });

  test("the route is read and written as JSON", async () => {
    const sent: [string, string | undefined, unknown][] = [];
    const api = inAppApiOver(async (path, init) => {
      sent.push([path, init.method, init.body ?? null]);
      return init.method === "GET"
        ? Response.json({ inApp: false })
        : Response.json({ inApp: true });
    });
    expect([await api.load(), await api.save(true)]).toEqual([false, true]);
    expect(sent).toEqual([
      ["/api/notifications/preferences", "GET", null],
      ["/api/notifications/preferences", "PUT", '{"inApp":true}'],
    ]);
  });
});
