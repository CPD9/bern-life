import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { desktopApps } from "./desktop-apps";
import { DesktopDialog, DesktopSurface } from "./desktop";
import { useDesktop } from "./use-desktop";

const apps = desktopApps(
  {
    navigator: <p>Navigator content</p>,
    agents: <p>Agents content</p>,
    reports: <p>Reports content</p>,
    messages: <p>Messages content</p>,
    settings: <p>Settings content</p>,
  },
  { messages: 2 },
);

function Harness({
  onLeave = () => undefined,
  now = null,
}: {
  onLeave?: () => void;
  now?: Date | null;
}) {
  const controller = useDesktop();
  return <DesktopSurface apps={apps} controller={controller} now={now} onLeave={onLeave} />;
}

function dockButton(label: string) {
  return screen.getByRole("button", { name: new RegExp(`^${label}`) });
}

function windowOf(label: string) {
  return screen.getByRole("region", { name: label });
}

function frontWindow() {
  const windows = [...document.querySelectorAll<HTMLElement>("[data-app-window]")];
  return windows.reduce((a, b) => (Number(b.style.zIndex) > Number(a.style.zIndex) ? b : a));
}

describe("DesktopSurface", () => {
  test("the menu bar names the front app, or Bern Life when nothing is open, with the Bern time", () => {
    render(<Harness now={new Date("2026-10-19T12:00:00Z")} />);
    const menuBar = screen.getByRole("banner", { name: "Menu bar" });
    expect(menuBar.textContent).toBe("Bern Life14:00Leave the desk");
    fireEvent.click(dockButton("Navigator"));
    fireEvent.click(dockButton("Reports"));
    expect(menuBar.textContent).toBe("Reports14:00Leave the desk");
    fireEvent.keyDown(document.activeElement!, { key: "F6" });
    expect(menuBar.textContent).toBe("Navigator14:00Leave the desk");
  });

  test("Leave the desk in the menu bar leaves", () => {
    const onLeave = mock(() => undefined);
    render(<Harness onLeave={onLeave} />);
    fireEvent.click(screen.getByRole("button", { name: "Leave the desk" }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  test("the hint to open an app shows only while no window is open", () => {
    render(<Harness />);
    expect(screen.getByText("Open an app from the dock.")).toBeTruthy();
    fireEvent.click(dockButton("Navigator"));
    expect(screen.queryByText("Open an app from the dock.")).toBeNull();
  });

  test("the dock opens an app in a window whose title takes focus", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    expect(windowOf("Navigator").textContent).toContain("Navigator content");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Navigator" }));
    expect(dockButton("Navigator").textContent).toContain(", open");
  });

  test("only wired apps are in the dock, and Messages carries its unread count", () => {
    render(<Harness />);
    const dock = screen.getByRole("toolbar", { name: "Apps" });
    expect([...dock.querySelectorAll("button")].map((button) => button.textContent)).toEqual([
      "Navigator",
      "Agents",
      "Reports",
      "2Messages, 2 unread",
      "Settings",
    ]);
    expect(screen.queryByRole("button", { name: /^Garage/ })).toBeNull();
  });

  test("Escape closes the front window and returns focus to its dock button", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.keyDown(screen.getByRole("heading", { name: "Navigator" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Navigator" })).toBeNull();
    expect(document.activeElement).toBe(dockButton("Navigator"));
  });

  test("Escape with no window open leaves the desk", () => {
    const onLeave = mock(() => undefined);
    render(<Harness onLeave={onLeave} />);
    fireEvent.keyDown(dockButton("Navigator"), { key: "Escape" });
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  test("the close light at the left of the title bar closes only its window", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.click(dockButton("Reports"));
    const close = screen.getByRole("button", { name: "Close Navigator" });
    expect(close.compareDocumentPosition(screen.getByRole("heading", { name: "Navigator" }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    fireEvent.click(close);
    expect(screen.queryByRole("region", { name: "Navigator" })).toBeNull();
    expect(windowOf("Reports")).toBeTruthy();
  });

  test("only the front window's title is full strength", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.click(dockButton("Reports"));
    expect(screen.getByRole("heading", { name: "Reports" }).classList.contains("text-ink")).toBe(
      true,
    );
    expect(
      screen.getByRole("heading", { name: "Navigator" }).classList.contains("text-muted"),
    ).toBe(true);
  });

  test("F6 brings the other window to the front with focus", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.click(dockButton("Reports"));
    expect(frontWindow().dataset.appWindow).toBe("reports");
    fireEvent.keyDown(document.activeElement!, { key: "F6" });
    expect(frontWindow().dataset.appWindow).toBe("navigator");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Navigator" }));
  });

  test("clicking a back window raises it", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.click(dockButton("Reports"));
    fireEvent.pointerDown(screen.getByText("Navigator content"));
    expect(frontWindow().dataset.appWindow).toBe("navigator");
  });

  test("Alt+arrow moves the front window by 16 px", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.keyDown(screen.getByRole("heading", { name: "Navigator" }), {
      key: "ArrowRight",
      altKey: true,
    });
    expect(windowOf("Navigator").style.getPropertyValue("--x")).toBe("40px");
  });

  test("arrows, Home and End move between dock apps", () => {
    render(<Harness />);
    dockButton("Navigator").focus();
    fireEvent.keyDown(dockButton("Navigator"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(dockButton("Agents"));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(dockButton("Settings"));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(dockButton("Navigator"));
    expect(dockButton("Navigator").tabIndex).toBe(0);
    expect(dockButton("Agents").tabIndex).toBe(-1);
  });

  test("the dialog shows its overlay inside it while open, so toasts are not left in the inert world", () => {
    function Dialog({ open }: { open: boolean }) {
      const controller = useDesktop();
      return (
        <DesktopDialog
          open={open}
          onClose={() => undefined}
          apps={apps}
          controller={controller}
          now={null}
          overlay={<p>A toast</p>}
        />
      );
    }
    const { rerender } = render(<Dialog open={false} />);
    expect(screen.queryByText("A toast")).toBeNull();
    rerender(<Dialog open />);
    const toast = screen.getByText("A toast");
    expect(toast.closest("dialog")).toBe(document.querySelector("dialog"));
    // Below the menu bar, so "Leave the desk" stays reachable.
    expect(toast.closest("[data-desktop-overlay]")?.className.split(" ")).toContain("top-7");
  });
});
