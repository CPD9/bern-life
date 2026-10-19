import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { LibraryItem } from "./library-items";
import { createLibraryStore } from "./library-store";
import { SaveButton } from "./save-button";
import { demoEntry, memoryStorage, savedItem } from "./testing";

const entry = demoEntry("demo-ada", "opportunity");
const at = new Date("2026-10-19T02:30:00.000Z");

describe("SaveButton", () => {
  test("saves once, calls onSaved once with the stamped item, then says Saved", () => {
    const store = createLibraryStore(() => memoryStorage());
    const heard: LibraryItem[] = [];
    render(
      <SaveButton
        entry={entry}
        store={store}
        now={() => at}
        onSaved={(item) => heard.push(item)}
      />,
    );
    const button = screen.getByRole("button", { name: "Save to library: Demo demo-ada" });
    act(() => fireEvent.click(button));
    act(() => fireEvent.click(button));
    const item = { ...entry, saved_at: "2026-10-19T02:30:00.000Z" };
    expect(heard).toEqual([item]);
    expect(store.get()).toEqual([item]);
    expect(button.textContent).toBe("Saved");
    expect(button.getAttribute("aria-label")).toBe("Saved: Demo demo-ada");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  test("something already in the library shows Saved and does not save again", () => {
    const store = createLibraryStore(() => memoryStorage());
    store.save(savedItem("demo-ada", "opportunity"));
    const heard: LibraryItem[] = [];
    render(<SaveButton entry={entry} store={store} onSaved={(item) => heard.push(item)} />);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Saved: Demo demo-ada" })));
    expect(heard).toEqual([]);
  });
});
