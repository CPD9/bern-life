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

  test("notifications from before mount do not pop up when they change", () => {
    const store = freshStore();
    store.notify(message);
    render(<Toasts store={store} schedule={manualTimers().schedule} reducedMotion={false} />);
    act(() => store.markRead("n1"));
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
