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

function Harness({ onLeave = () => undefined }: { onLeave?: () => void }) {
  const controller = useDesktop();
  return <DesktopSurface apps={apps} controller={controller} now={null} onLeave={onLeave} />;
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

  test("the close button closes only its window", () => {
    render(<Harness />);
    fireEvent.click(dockButton("Navigator"));
    fireEvent.click(dockButton("Reports"));
    fireEvent.click(screen.getByRole("button", { name: "Close Navigator" }));
    expect(screen.queryByRole("region", { name: "Navigator" })).toBeNull();
    expect(windowOf("Reports")).toBeTruthy();
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
    expect(screen.getByText("A toast").closest("dialog")).toBe(document.querySelector("dialog"));
  });
});
