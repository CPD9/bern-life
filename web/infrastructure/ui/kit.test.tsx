import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Badge } from "./badge";
import { IconButton } from "./button";
import { Sheet } from "./sheet";
import { Toggle } from "./toggle";

function ToggleHarness({ disabled = false }: { disabled?: boolean }) {
  const [on, setOn] = useState(false);
  return <Toggle label="Lite graphics" checked={on} onChange={setOn} disabled={disabled} />;
}

describe("Toggle", () => {
  test("is a switch that flips and reports aria-checked", () => {
    render(<ToggleHarness />);
    const toggle = screen.getByRole("switch", { name: "Lite graphics" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  test("a disabled switch does not flip, and its row is dimmed", () => {
    render(<ToggleHarness disabled />);
    const toggle = screen.getByRole("switch", { name: "Lite graphics" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    expect(toggle.parentElement!.classList.contains("opacity-40")).toBe(true);
  });

  test("is an iOS switch: a 51 by 31 pt track, a 27 pt knob, green when on", () => {
    render(<ToggleHarness />);
    const toggle = screen.getByRole("switch", { name: "Lite graphics" });
    const has = (name: string) => toggle.classList.contains(name);
    expect([has("w-[51px]"), has("h-[31px]"), has("bg-primary"), has("duration-200")]).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect(toggle.firstElementChild!.classList.contains("size-[27px]")).toBe(true);
    fireEvent.click(toggle);
    expect(has("bg-primary")).toBe(true);
    expect(toggle.firstElementChild!.classList.contains("translate-x-5")).toBe(true);
  });
});

test("an icon button is named by its label, not its icon", () => {
  render(<IconButton label="Back" icon="‹" />);
  expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
});

test("a badge shows nothing for 0 or an unknown count", () => {
  const { container, rerender } = render(<Badge count={0} label="unread" />);
  expect(container.innerHTML).toBe("");
  rerender(<Badge count={undefined} label="unread" />);
  expect(container.innerHTML).toBe("");
  rerender(<Badge count={3} label="unread" dot />);
  expect(screen.getByRole("img", { name: "3 unread" })).toBeTruthy();
});

function SheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      {open && (
        <Sheet title="Notifications" onClose={() => setOpen(false)}>
          <button type="button">First inside</button>
          <button type="button">Last inside</button>
        </Sheet>
      )}
    </>
  );
}

describe("Sheet", () => {
  test("takes focus, keeps Tab inside, and gives focus back on close", async () => {
    render(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Open sheet" });
    opener.focus();
    await act(async () => fireEvent.click(opener));
    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Notifications" }));

    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last inside" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    expect(dialog.contains(document.activeElement)).toBe(true);

    await act(async () => fireEvent.keyDown(last, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  test("Shift+Tab straight after opening, from the heading, wraps to the last control", async () => {
    render(<SheetHarness />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open sheet" })));
    const heading = screen.getByRole("heading", { name: "Notifications" });
    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(heading, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Last inside" }));
  });

  test("Escape in a sheet inside a window that also listens closes only the sheet", async () => {
    let windowEscapes = 0;
    function WindowWithSheet() {
      return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a stand-in desktop window
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape") windowEscapes++;
          }}
        >
          <SheetHarness />
        </div>
      );
    }
    render(<WindowWithSheet />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open sheet" })));
    const inside = screen.getByRole("button", { name: "Last inside" });
    inside.focus();
    await act(async () => fireEvent.keyDown(inside, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(windowEscapes).toBe(0);
  });

  test("Escape with focus on <body> closes it", async () => {
    render(<SheetHarness />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Open sheet" })));
    (document.activeElement as HTMLElement).blur();
    await act(async () => fireEvent.keyDown(document.body, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

test("a sheet with a grabber puts its action between the title and Close", () => {
  render(
    <Sheet title="Notifications" onClose={() => undefined} grabber actions={<button>Mark</button>}>
      <p>Rows</p>
    </Sheet>,
  );
  const dialog = screen.getByRole("dialog", { name: "Notifications" });
  const names = Array.from(dialog.querySelectorAll("h2, button")).map(
    (node) => node.getAttribute("aria-label") ?? node.textContent,
  );
  expect(names).toEqual(["Notifications", "Mark", "Close"]);
  expect(dialog.querySelector("header")!.previousElementSibling!.getAttribute("aria-hidden")).toBe(
    "true",
  );
});
