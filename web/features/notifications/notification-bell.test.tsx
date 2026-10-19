import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NotificationBell } from "./notification-bell";
import { createNotificationStore } from "./notification-store";

const stored = JSON.stringify([
  {
    id: "n2",
    kind: "loop",
    title: "Your loop found a new lab",
    body: "Wound healing, ARTORG",
    at: "2026-10-19T09:05:00.000Z",
    read: false,
    href: "/navigator",
  },
  {
    id: "n1",
    kind: "system",
    title: "New snapshot",
    body: "Pages fetched on 18 Oct",
    at: "2026-10-18T20:00:00.000Z",
    read: true,
  },
]);

function storeWith(raw: string | null) {
  let count = 2;
  const storage = { getItem: () => raw, setItem: () => {} };
  return createNotificationStore(() => storage, {
    now: () => new Date("2026-10-19T09:30:00.000Z"),
    newId: () => `n${++count}`,
  });
}

const now = new Date("2026-10-19T10:00:00.000Z");

describe("NotificationBell", () => {
  test("the bell names the unread count and follows new notifications", () => {
    const store = storeWith(stored);
    render(<NotificationBell store={store} now={now} />);
    const bell = screen.getByRole("button", { name: "Notifications, 1 unread" });
    expect(bell.textContent).toBe("1");
    act(() => {
      store.notify({ kind: "message", title: "Bea wrote", body: "See you at ARTORG" });
    });
    expect(bell.getAttribute("aria-label")).toBe("Notifications, 2 unread");
    expect(bell.textContent).toBe("2");
  });

  test("no badge and a plain name when nothing is unread", () => {
    render(<NotificationBell store={storeWith(null)} now={now} />);
    expect(screen.getByRole("button", { name: "Notifications" }).textContent).toBe("");
  });

  test("the list shows newest first with kind, title, body and Bern time", () => {
    render(<NotificationBell store={storeWith(stored)} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 1 unread" }));
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "LoopYour loop found a new labWound healing, ARTORGUnread, 11:05",
      "Bern LifeNew snapshotPages fetched on 18 OctSun 18 Oct, 22:00",
    ]);
    const link = screen.getByRole("link", { name: "Your loop found a new lab" });
    expect(link.getAttribute("href")).toBe("/navigator");
  });

  test("following a notification marks it read; Mark all read clears the count", () => {
    const store = storeWith(stored);
    render(<NotificationBell store={store} now={now} />);
    act(() => {
      store.notify({ kind: "connection", title: "Cem connected", body: "Biomedical engineering" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Notifications, 2 unread" }));
    fireEvent.click(screen.getByRole("link", { name: "Your loop found a new lab" }));
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark all read" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  test("an empty list says what will show up; Escape closes it and returns focus", () => {
    render(<NotificationBell store={storeWith(null)} now={now} />);
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    expect(bell.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/^Nothing yet/)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("region", { name: "Notifications" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull();
    expect(bell.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(bell);
  });

  test("an Escape from outside the bell and its list leaves the list open", () => {
    render(
      <>
        <input aria-label="Elsewhere" />
        <NotificationBell store={storeWith(null)} now={now} />
      </>,
    );
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Elsewhere" }), { key: "Escape" });
    expect(screen.getByRole("region", { name: "Notifications" })).toBeTruthy();
    expect(bell.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(bell, { key: "Escape" });
    expect(bell.getAttribute("aria-expanded")).toBe("false");
  });
});
