import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createNotificationStore } from "./notification-store";
import { type After, TOAST_MS, Toasts } from "./toasts";

function freshStore() {
  let count = 0;
  const storage = { getItem: () => null, setItem: () => {} };
  return createNotificationStore(() => storage, { newId: () => `n${++count}` });
}

// Collects scheduled dismissals so a test runs them when it chooses.
function manualTimers() {
  const pending: { run: () => void; ms: number; cancelled: boolean }[] = [];
  const schedule: After = (run, ms) => {
    const entry = { run, ms, cancelled: false };
    pending.push(entry);
    return () => {
      entry.cancelled = true;
    };
  };
  const live = () => pending.filter((entry) => !entry.cancelled);
  return { schedule, live };
}

const message = { kind: "message", title: "Bea wrote", body: "See you at ARTORG" } as const;

describe("Toasts", () => {
  test("a new notification shows in a polite live region and Dismiss removes it", () => {
    const store = freshStore();
    render(<Toasts store={store} schedule={manualTimers().schedule} reducedMotion={false} />);
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    act(() => {
      store.notify(message);
    });
    expect(region.textContent).toBe("MessageBea wroteSee you at ARTORGDismiss");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Bea wrote" }));
    expect(region.textContent).toBe("");
    expect(store.list()[0]?.read).toBe(false);
  });

  test("a toast leaves by itself after the timeout", () => {
    const store = freshStore();
    const { schedule, live } = manualTimers();
    render(<Toasts store={store} schedule={schedule} reducedMotion={false} />);
    act(() => {
      store.notify(message);
    });
    expect(live().map((entry) => entry.ms)).toEqual([TOAST_MS]);
    act(() => live()[0]?.run());
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  test("under reduced motion a toast stays until dismissed", () => {
    const store = freshStore();
    const { schedule, live } = manualTimers();
    render(<Toasts store={store} schedule={schedule} reducedMotion />);
    act(() => {
      store.notify(message);
    });
    expect(live()).toEqual([]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  test("a focused toast waits, and its timer starts again when focus leaves", () => {
    const store = freshStore();
    const { schedule, live } = manualTimers();
    render(<Toasts store={store} schedule={schedule} reducedMotion={false} />);
    act(() => {
      store.notify(message);
    });
    const dismiss = screen.getByRole("button", { name: "Dismiss Bea wrote" });
    fireEvent.focusIn(dismiss);
    expect(live()).toEqual([]);
    fireEvent.focusOut(dismiss);
    expect(live()).toHaveLength(1);
  });

  test("the pointer leaving does not cut short a toast held by keyboard focus", () => {
    const store = freshStore();
    const { schedule, live } = manualTimers();
    render(<Toasts store={store} schedule={schedule} reducedMotion={false} />);
    act(() => {
      store.notify(message);
    });
    const card = screen.getByRole("listitem");
    const dismiss = screen.getByRole("button", { name: "Dismiss Bea wrote" });
    fireEvent.focusIn(dismiss);
    fireEvent.pointerEnter(card);
    fireEvent.pointerLeave(card);
    expect(live()).toEqual([]);
    fireEvent.focusOut(dismiss);
    expect(live()).toHaveLength(1);
  });

  test("focus moving inside a toast keeps it held", () => {
    const store = freshStore();
    const { schedule, live } = manualTimers();
    render(<Toasts store={store} schedule={schedule} reducedMotion={false} />);
    act(() => {
      store.notify({ ...message, href: "/messages" });
    });
    const link = screen.getByRole("link", { name: "Bea wrote" });
    const dismiss = screen.getByRole("button", { name: "Dismiss Bea wrote" });
    fireEvent.focusIn(link);
    fireEvent.focusOut(link, { relatedTarget: dismiss });
    fireEvent.focusIn(dismiss);
    expect(live()).toEqual([]);
  });

  test("Dismiss moves focus to the next toast, then back to where focus came from", () => {
    const store = freshStore();
    render(
      <>
        <button type="button">Before</button>
        <Toasts store={store} schedule={manualTimers().schedule} reducedMotion={false} />
      </>,
    );
    act(() => {
      store.notify({ kind: "message", title: "First", body: "One" });
      store.notify({ kind: "message", title: "Second", body: "Two" });
    });
    const before = screen.getByRole("button", { name: "Before" });
    const second = screen.getByRole("button", { name: "Dismiss Second" });
    second.focus();
    fireEvent.focusIn(second, { relatedTarget: before });
    fireEvent.click(second);
    const first = screen.getByRole("button", { name: "Dismiss First" });
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    expect(screen.queryByRole("listitem")).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  test("a Dismiss pressed without focus on it leaves focus alone", () => {
    const store = freshStore();
    render(<Toasts store={store} schedule={manualTimers().schedule} reducedMotion={false} />);
    act(() => {
      store.notify({ kind: "message", title: "First", body: "One" });
      store.notify({ kind: "message", title: "Second", body: "Two" });
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Second" }));
    expect(document.activeElement).toBe(document.body);
  });

  test("notifications from before mount do not pop up when they change", () => {
    const store = freshStore();
    store.notify(message);
    render(<Toasts store={store} schedule={manualTimers().schedule} reducedMotion={false} />);
    act(() => store.markRead("n1"));
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
