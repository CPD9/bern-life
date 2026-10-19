import { describe, expect, test } from "bun:test";
import type React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { type PhoneApp, type PhoneHealth, type PhoneNotification, Phone } from "./phone";

const apps: PhoneApp[] = [
  { id: "ask", label: "Ask", icon: null, tile: "#13804a", content: <p>Ask content</p> },
  {
    id: "messages",
    label: "Messages",
    icon: null,
    tile: "#1d6fd6",
    content: <p>Messages content</p>,
  },
  { id: "settings", label: "Settings", icon: null, tile: "#475569", content: <p>Settings</p> },
];

type HarnessProps = {
  overlay?: React.ReactNode;
  health?: PhoneHealth;
  unreadMessages?: number;
  notifications?: readonly PhoneNotification[];
  onOpenNotification?: (notification: PhoneNotification) => void;
  onMarkAllRead?: () => void;
  phoneApps?: PhoneApp[];
};

function Harness({ phoneApps = apps, onOpenNotification, ...rest }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  // Ask can send the player to Settings from inside, the way an app's "Try" link does.
  const wired = phoneApps.map((app) =>
    app.id === "ask"
      ? {
          ...app,
          content: (
            <>
              {app.content}
              <button type="button" onClick={() => setAppId("settings")}>
                Try settings
              </button>
            </>
          ),
        }
      : app,
  );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Phone
      </button>
      <button type="button" onClick={() => setAppId("settings")}>
        Open settings from outside
      </button>
      <span data-testid="state">{open ? "open" : "closed"}</span>
      <Phone
        open={open}
        onClose={() => setOpen(false)}
        apps={wired}
        appId={appId}
        onAppChange={setAppId}
        now={new Date("2026-10-19T02:05:00Z")}
        onOpenNotification={(notification) => {
          onOpenNotification?.(notification);
          setAppId("messages");
        }}
        {...rest}
      />
    </>
  );
}

function openPhone() {
  const opener = screen.getByRole("button", { name: "Phone" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

const health = (mode: "live" | "replay" | "mock"): PhoneHealth => ({
  status: "ok",
  health: { mode, snapshot: "2026-10-18", counts: { profiles: 12 } },
});

describe("Phone", () => {
  test("opens as a modal dialog with Bern time and the app tiles", () => {
    render(<Harness />);
    openPhone();
    expect(document.querySelector("dialog")!.open).toBe(true);
    expect(document.querySelector("time")!.textContent).toBe("04:05");
    expect(screen.getByRole("button", { name: "Ask" })).toBeTruthy();
    expect(
      within(screen.getByRole("navigation", { name: "Dock" })).getAllByRole("button"),
    ).toHaveLength(3);
  });

  test("neither the dialog nor the frame can scroll, so the status bar never drifts away", () => {
    render(<Harness />);
    openPhone();
    const dialog = document.querySelector("dialog")!;
    expect(dialog.className).toContain("overflow-clip");
    expect(dialog.firstElementChild!.className).toContain("overflow-clip");
    expect(dialog.className).not.toContain("overflow-hidden");
  });

  test("the status chip says what health says in plain words, and nothing while unknown", () => {
    const { rerender } = render(<Harness health={health("live")} />);
    openPhone();
    const chip = () => document.querySelector("[aria-live] button")?.textContent ?? "";
    expect(chip()).toBe("Live");
    rerender(<Harness health={health("replay")} />);
    expect(chip()).toBe("Recorded");
    rerender(<Harness health={health("mock")} />);
    expect(chip()).toBe("Your words only");
    rerender(<Harness health={{ status: "offline" }} />);
    expect(chip()).toBe("Offline");
    rerender(<Harness health={{ status: "waiting" }} />);
    expect(chip()).toBe("");
    rerender(<Harness />);
    expect(chip()).toBe("");
  });

  test("dots and badges are hidden at 0 and when unknown, shown with a count", () => {
    const counted = apps.map((app) => (app.id === "messages" ? { ...app, badge: 0 } : app));
    const { rerender } = render(
      <Harness unreadMessages={0} notifications={[]} phoneApps={counted} />,
    );
    openPhone();
    expect(screen.queryByRole("img", { name: /unread/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Messages" })).toBeTruthy();
    const badged = apps.map((app) => (app.id === "messages" ? { ...app, badge: 2 } : app));
    rerender(<Harness unreadMessages={2} notifications={[unread]} phoneApps={badged} />);
    expect(screen.getByRole("img", { name: "2 unread messages" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Messages, 2 new" })).toBeTruthy();
  });

  test("Back and Escape return to the app before, then home, focusing the tile that opened it", async () => {
    render(<Harness />);
    openPhone();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Ask" }));
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Open settings from outside" })),
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Back to Ask" })));
    expect(screen.getByText("Ask content")).toBeTruthy();
    await act(async () => fireEvent.keyDown(document.activeElement!, { key: "Escape" }));
    expect(screen.queryByText("Ask content")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByTestId("state").textContent).toBe("open");
  });

  test("Escape with focus on <body> still goes back inside an app", async () => {
    render(<Harness />);
    openPhone();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    await act(async () => fireEvent.keyDown(document.body, { key: "Escape" }));
    expect(screen.queryByText("Ask content")).toBeNull();
    expect(document.querySelector("dialog")!.open).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask" }));
  });

  test("switching apps from inside an app moves focus to the new app's title", async () => {
    render(<Harness />);
    openPhone();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try settings" })));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Settings" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Back to Ask" })));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Ask" }));
  });

  test("an overlay renders inside the phone's dialog, below an open app's header", async () => {
    render(<Harness overlay={<p>Toast here</p>} notifications={[]} />);
    openPhone();
    const box = () => document.querySelector<HTMLElement>("[data-phone-overlay]")!;
    expect(document.querySelector("dialog")!.contains(screen.getByText("Toast here"))).toBe(true);
    expect(box().classList.contains("top-0")).toBe(true);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    const header = screen.getByRole("button", { name: "Back to Home" }).closest("header")!;
    expect(box().classList.contains("top-11")).toBe(true);
    expect(box().classList.contains("top-0")).toBe(false);
    // The box is layered after the app's header, not around it, so the offset is what keeps
    // toasts off Back and the title.
    expect(box().contains(header)).toBe(false);
    expect(header.compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(box().parentElement!.contains(header)).toBe(true);

    // The notification centre covers the app's header; toasts then start under the status bar.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Notifications" })));
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeTruthy();
    expect(box().classList.contains("top-0")).toBe(true);
    expect(box().classList.contains("top-11")).toBe(false);
  });

  test("the back button is named for where it leads: Home, then the app before", async () => {
    render(<Harness />);
    openPhone();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    const back = () => screen.getByRole("button", { name: /^Back to / });
    expect([back().getAttribute("aria-label"), back().textContent]).toEqual([
      "Back to Home",
      "Home",
    ]);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try settings" })));
    expect([back().getAttribute("aria-label"), back().textContent]).toEqual(["Back to Ask", "Ask"]);
    const bar = screen.getByRole("heading", { name: "Settings" }).closest("header")!;
    expect(bar.classList.contains("h-11")).toBe(true);
    expect(screen.getByRole("button", { name: "Close" }).classList.contains("size-11")).toBe(true);
  });

  test("Close shuts the phone and gives focus back to what opened it", async () => {
    render(<Harness />);
    const opener = openPhone();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(document.querySelector("dialog")!.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  test("closing by Escape (the dialog's close event) also reports the phone closed", async () => {
    render(<Harness />);
    const opener = openPhone();
    await act(async () => {
      document.querySelector("dialog")!.dispatchEvent(new Event("close"));
    });
    expect(screen.getByTestId("state").textContent).toBe("closed");
    expect(document.activeElement).toBe(opener);
  });
});

const unread: PhoneNotification = {
  id: "n1",
  kind: "message",
  title: "demo-bea wrote",
  at: "2026-10-19T01:40:00Z",
  read: false,
};
const read: PhoneNotification = {
  id: "n2",
  kind: "loop",
  title: "Loop found 2 new labs",
  at: "2026-10-17T21:40:00Z",
  read: true,
};

describe("Notification centre", () => {
  test("says so plainly when there are none", async () => {
    render(<Harness notifications={[]} />);
    openPhone();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Notifications" })));
    const sheet = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(sheet).getByText("No notifications")).toBeTruthy();
    expect(within(sheet).queryByRole("button", { name: "Mark all read" })).toBeNull();
  });

  test("lists items with kind and Bern time, opens one, marks all read", async () => {
    const opened: string[] = [];
    let marked = 0;
    render(
      <Harness
        notifications={[unread, read]}
        onOpenNotification={(notification) => opened.push(notification.id)}
        onMarkAllRead={() => marked++}
      />,
    );
    openPhone();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" })),
    );
    const sheet = screen.getByRole("dialog", { name: "Notifications" });
    const rows = within(sheet)
      .getAllByRole("listitem")
      .map((row) => row.textContent);
    expect(rows).toEqual([
      "Unread: demo-bea wroteMessage03:40",
      "Loop found 2 new labsLoopSat 17 Oct, 23:40",
    ]);
    fireEvent.click(within(sheet).getByRole("button", { name: "Mark all read" }));
    expect(marked).toBe(1);
    await act(async () =>
      fireEvent.click(within(sheet).getByRole("button", { name: /demo-bea wrote/ })),
    );
    expect(opened).toEqual(["n1"]);
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Messages" }));
  });

  test("Escape in the centre over an app closes only the centre", async () => {
    render(<Harness notifications={[unread]} />);
    openPhone();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    const bell = screen.getByRole("button", { name: "Notifications, 1 unread" });
    bell.focus();
    await act(async () => fireEvent.click(bell));
    const sheet = screen.getByRole("dialog", { name: "Notifications" });
    await act(async () => fireEvent.keyDown(within(sheet).getByRole("heading"), { key: "Escape" }));
    expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull();
    expect(screen.getByText("Ask content")).toBeTruthy();
    expect(document.activeElement).toBe(bell);
  });
});
