import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LumiFloatie } from "./lumi-floatie";

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

  test("the agent's name is the only thing written under it", () => {
    show("Bärli", () => undefined);
    expect(screen.getByText("Bärli").getAttribute("aria-hidden")).toBe("true");
  });
});
