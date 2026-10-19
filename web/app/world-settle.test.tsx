import { afterEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { defaultBear } from "@/features/avatar/bear-config";
import { emptyProfile } from "@/features/onboarding/profile";
import { emptyStoryState, storyProgress } from "@/features/story/engine";
import { YouSheet } from "@/features/you/you-sheet";
import { emittedToday } from "@/infrastructure/app-events";
import { storyFixture } from "@/test/story";
import { createSettleStore } from "@/features/settle/settle-store";
import { useWorldSettle } from "./world-settle";

function memoryStore() {
  const items = new Map<string, string>();
  return createSettleStore(() => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  }));
}

const settleDone = () => new Promise((resolve) => setTimeout(resolve, 5));

function setUp() {
  const landing = document.createElement("div");
  landing.tabIndex = -1;
  document.body.append(landing);
  const opener = document.createElement("button");
  opener.textContent = "Choose a plot";
  document.body.append(opener);
  opener.focus();
  const store = memoryStore();
  const { result } = renderHook(() =>
    useWorldSettle({ emit: () => undefined }, { store: () => store, landing: () => landing }),
  );
  act(() => result.current.open());
  const view = render(<>{result.current.dialog as ReactNode}</>);
  const refresh = () => view.rerender(<>{result.current.dialog as ReactNode}</>);
  return { landing, opener, result, refresh };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focus around settling", () => {
  test("settling replaces the card that opened it, so focus lands on the side cards", async () => {
    const { landing, opener, refresh } = setUp();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Settle in Altstadt" })));
    opener.remove();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    refresh();
    await act(settleDone);
    expect(document.activeElement).toBe(landing);
  });

  test("when what opened it is still there, focus goes back to it", async () => {
    const { opener, refresh } = setUp();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    refresh();
    await act(settleDone);
    expect(document.activeElement).toBe(opener);
  });

  test("Not now removes the card, and focus lands on the side cards", async () => {
    const { landing, opener, result } = setUp();
    act(() => result.current.dismiss());
    opener.remove();
    await act(settleDone);
    expect(result.current.dismissed).toBe(true);
    expect(document.activeElement).toBe(landing);
  });
});

function YouThenSettle() {
  const store = memoryStore();
  const settle = useWorldSettle({ emit: () => undefined }, { store: () => store });
  const [youOpen, setYouOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setYouOpen(true)}>
        You
      </button>
      {youOpen && (
        <YouSheet
          profile={emptyProfile}
          agent={{ name: "Lumi", bear: defaultBear }}
          story={storyProgress(storyFixture, emptyStoryState, emittedToday)}
          onClose={() => setYouOpen(false)}
          onMoveOffice={settle.open}
        />
      )}
      {settle.dialog}
    </>
  );
}

describe("moving your office from the You sheet", () => {
  test("Settle opens in place of the sheet, and closing it puts focus back on You", async () => {
    render(<YouThenSettle />);
    const you = screen.getByRole("button", { name: "You" });
    you.focus();
    act(() => fireEvent.click(you));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move your office" }));
    });
    expect(screen.queryByRole("dialog", { name: "You" })).toBeNull();
    expect(screen.getByRole("button", { name: "Settle in Altstadt" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    await act(settleDone);
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(you);
  });
});
