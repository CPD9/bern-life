import { describe, expect, test } from "bun:test";
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
  health?: PhoneHealth;
  unreadMessages?: number;
  notifications?: readonly PhoneNotification[];
  onOpenNotification?: (notification: PhoneNotification) => void;
  onMarkAllRead?: () => void;
  phoneApps?: PhoneApp[];
};

function Harness({ phoneApps = apps, ...rest }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
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
        apps={phoneApps}
        appId={appId}
        onAppChange={setAppId}
        now={new Date("2026-10-19T02:05:00Z")}
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

  test("the engine chip says what health says, and nothing while unknown", () => {
    const { rerender } = render(<Harness health={health("live")} />);
    openPhone();
    const chip = () => document.querySelector("[aria-live]")!.textContent;
    expect(chip()).toBe("Live");
    rerender(<Harness health={health("replay")} />);
    expect(chip()).toBe("Replay");
    rerender(<Harness health={health("mock")} />);
    expect(chip()).toBe("MOCK");
    rerender(<Harness health={{ status: "offline" }} />);
    expect(chip()).toBe("Engine offline");
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
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Back" })));
    expect(screen.getByText("Ask content")).toBeTruthy();
    await act(async () => fireEvent.keyDown(document.activeElement!, { key: "Escape" }));
    expect(screen.queryByText("Ask content")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByTestId("state").textContent).toBe("open");
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
    fireEvent.click(within(sheet).getByRole("button", { name: /demo-bea wrote/ }));
    fireEvent.click(within(sheet).getByRole("button", { name: "Mark all read" }));
    expect(opened).toEqual(["n1"]);
    expect(marked).toBe(1);
  });
});
