import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { assumeWebgl } from "@/infrastructure/webgl";

// three.js has to finish loading as a module before the canvas library requires it, or Bun can
// refuse the require part of the time; a test file loads both at once unless told otherwise.
await import("three");
const { LumiFloatie } = await import("./lumi-floatie");

function show(name: string, onOpen: () => void) {
  render(<LumiFloatie name={name} figure={() => null} onOpen={onOpen} />);
  return screen.getByRole("button", { name: `${name}, your agent` });
}

describe("LumiFloatie", () => {
  test("a tap opens Lumi once", () => {
    const onOpen = mock(() => undefined);
    fireEvent.click(show("Lumi", onOpen));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("it takes keyboard focus as a page button, so Enter and Space open it too", () => {
    const floatie = show("Bärli", () => undefined);
    act(() => floatie.focus());
    expect(document.activeElement).toBe(floatie);
    expect([floatie.tagName, floatie.getAttribute("type")]).toEqual(["BUTTON", "button"]);
  });

  test("the agent's name under it is hidden from screen readers and lets taps through", () => {
    show("Bärli", () => undefined);
    const pill = screen.getByText("Bärli");
    expect(pill.getAttribute("aria-hidden")).toBe("true");
    expect(pill.className).toContain("pointer-events-none");
  });

  describe("without WebGL", () => {
    // Unmounted first, so putting WebGL back re-renders nothing outside act().
    afterEach(() => {
      cleanup();
      assumeWebgl(true);
    });

    test("the button stays and still opens Lumi, with the initial where the bear would be", () => {
      assumeWebgl(false);
      const onOpen = mock(() => undefined);
      const floatie = show("Bärli", onOpen);
      expect(floatie.querySelector("canvas")).toBeNull();
      expect(floatie.textContent).toBe("B");
      fireEvent.click(floatie);
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });
});
