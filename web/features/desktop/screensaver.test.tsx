import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { desktopApps } from "./desktop-apps";
import { DesktopDialog, DesktopSurface } from "./desktop";
import { Screensaver } from "./screensaver";
import { useDesktop } from "./use-desktop";
import type { Scheduler } from "./use-idle";

const apps = desktopApps(
  { navigator: <p>Navigator content</p>, settings: <p>Settings content</p> },
  {},
);

// 12:00 UTC on 19 October is 14:00 in Bern.
const twoInBern = new Date("2026-10-19T12:00:00Z");

type Pending = { callback: () => void; delay: number };

function fakeScheduler() {
  const pending: Pending[] = [];
  const schedule: Scheduler = (callback, delay) => {
    const entry = { callback, delay };
    pending.push(entry);
    return () => {
      const at = pending.indexOf(entry);
      if (at >= 0) pending.splice(at, 1);
    };
  };
  const fire = () => act(() => pending.splice(0).forEach((entry) => entry.callback()));
  return { schedule, pending, fire };
}

function Harness({
  schedule,
  onLeave = () => undefined,
}: {
  schedule: Scheduler;
  onLeave?: () => void;
}) {
  const controller = useDesktop();
  return (
    <DesktopSurface
      apps={apps}
      controller={controller}
      now={twoInBern}
      onLeave={onLeave}
      schedule={schedule}
    />
  );
}

const saver = () => document.querySelector("[data-screensaver]");

describe("the screensaver", () => {
  test("appears after 90 seconds without activity, with the scene, the time and Bern Life", () => {
    const timers = fakeScheduler();
    render(<Harness schedule={timers.schedule} />);
    expect(timers.pending.map((entry) => entry.delay)).toEqual([90_000]);
    expect(saver()).toBeNull();
    timers.fire();
    expect(saver()!.textContent).toBe("14:00Bern Life");
    expect(saver()!.querySelector("[data-wallpaper]")?.getAttribute("data-wallpaper")).toBe("bern");
  });

  test("activity restarts the 90 seconds", () => {
    const timers = fakeScheduler();
    render(<Harness schedule={timers.schedule} />);
    const [first] = timers.pending;
    fireEvent.pointerMove(screen.getByRole("button", { name: /^Navigator/ }));
    expect(timers.pending.length).toBe(1);
    expect(timers.pending[0]).not.toBe(first);
    expect(timers.pending[0]?.delay).toBe(90_000);
  });

  test("a key wakes the desk at once, and focus is back where it was", () => {
    const timers = fakeScheduler();
    render(<Harness schedule={timers.schedule} />);
    const navigator = screen.getByRole("button", { name: /^Navigator/ });
    navigator.focus();
    timers.fire();
    expect(saver()).not.toBeNull();
    fireEvent.keyDown(navigator, { key: "a" });
    expect(saver()).toBeNull();
    expect(document.activeElement).toBe(navigator);
    expect(timers.pending.map((entry) => entry.delay)).toEqual([90_000]);
  });

  test("Escape wakes the desk without leaving it", () => {
    const timers = fakeScheduler();
    const onLeave = mock(() => undefined);
    render(<Harness schedule={timers.schedule} onLeave={onLeave} />);
    const navigator = screen.getByRole("button", { name: /^Navigator/ });
    navigator.focus();
    timers.fire();
    fireEvent.keyDown(navigator, { key: "Escape" });
    expect(saver()).toBeNull();
    expect(onLeave).not.toHaveBeenCalled();
  });

  test("a tap wakes the desk without pressing what was under it", () => {
    const timers = fakeScheduler();
    render(<Harness schedule={timers.schedule} />);
    timers.fire();
    fireEvent.pointerDown(saver()!);
    expect(saver()).not.toBeNull();
    fireEvent.click(saver()!);
    expect(saver()).toBeNull();
    expect(screen.queryByRole("region", { name: "Navigator" })).toBeNull();
  });

  test("no timer runs while the desk is closed", () => {
    const timers = fakeScheduler();
    function Dialog({ open }: { open: boolean }) {
      const controller = useDesktop();
      return (
        <DesktopDialog
          open={open}
          onClose={() => undefined}
          apps={apps}
          controller={controller}
          now={twoInBern}
          schedule={timers.schedule}
        />
      );
    }
    const { rerender } = render(<Dialog open={false} />);
    expect(timers.pending).toEqual([]);
    rerender(<Dialog open />);
    expect(timers.pending.map((entry) => entry.delay)).toEqual([90_000]);
    rerender(<Dialog open={false} />);
    expect(timers.pending).toEqual([]);
  });

  test("with reduced motion or lite graphics it appears without animation", () => {
    const moving = render(<Screensaver scene="aare" now={twoInBern} still={false} />);
    expect(saver()!.className.split(" ")).toContain("animate-fade-in");
    moving.unmount();
    render(<Screensaver scene="aare" now={twoInBern} still />);
    expect(saver()!.className.split(" ")).not.toContain("animate-fade-in");
    expect(saver()!.querySelectorAll('[class*="animate-"]').length).toBe(0);
  });
});
