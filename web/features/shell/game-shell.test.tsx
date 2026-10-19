import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { GameShell, type WorldView } from "./game-shell";
import type { WatchHud } from "./watch-hud";

function Shell(props: { floatieHidden?: boolean; view?: WorldView; watchHud?: WatchHud }) {
  return (
    <GameShell
      view="map"
      phoneOpen={false}
      onSelectTab={() => undefined}
      hud={<p>Goal Explore</p>}
      side={<p>Tap a place.</p>}
      canvas={<button type="button">A place</button>}
      floatie={<button type="button">Bärli, your agent</button>}
      {...props}
      overlay={null}
    />
  );
}

function shell(props: { floatieHidden?: boolean } = {}) {
  return render(<Shell {...props} />);
}

describe("GameShell", () => {
  test("the floatie shows beside the world", () => {
    shell();
    expect(screen.getByRole("button", { name: "Bärli, your agent" })).toBeTruthy();
  });

  test("while hidden, the floatie is out of sight and out of the tab order", () => {
    shell({ floatieHidden: true });
    expect(screen.queryByRole("button", { name: "Bärli, your agent" })).toBeNull();
    const floatie = screen.getByText("Bärli, your agent");
    expect(floatie.parentElement?.hidden).toBe(true);
  });

  test("a floatie hidden while it holds focus hands focus to the tab of the view on screen", () => {
    const view = render(<Shell view="home" />);
    screen.getByRole("button", { name: "Bärli, your agent" }).focus();
    view.rerender(<Shell view="map" floatieHidden />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Map" }));
    expect(document.activeElement?.getAttribute("aria-current")).toBe("true");
  });

  test("hiding the floatie leaves focus elsewhere where it is", () => {
    const view = render(<Shell />);
    const place = screen.getByRole("button", { name: "A place" });
    place.focus();
    view.rerender(<Shell floatieHidden />);
    expect(document.activeElement).toBe(place);
  });

  test("writes the HUD's measured bottom for what stacks under it, and stops watching on unmount", () => {
    const watched: { hud: HTMLElement | null; onBottom: (bottom: number) => void } = {
      hud: null,
      onBottom: () => undefined,
    };
    let stopped = 0;
    const watchHud: WatchHud = (hud, onBottom) => {
      watched.hud = hud;
      watched.onBottom = onBottom;
      return () => {
        stopped += 1;
      };
    };
    const view = render(<Shell watchHud={watchHud} />);
    const root = view.container.firstElementChild as HTMLElement;
    expect(watched.hud?.textContent).toBe("Goal Explore");
    watched.onBottom(134);
    expect(root.style.getPropertyValue("--hud-bottom")).toBe("134px");
    watched.onBottom(98);
    expect(root.style.getPropertyValue("--hud-bottom")).toBe("98px");
    view.unmount();
    expect(stopped).toBe(1);
  });

  test("on a phone the side cards start under the HUD and a two-line search summary", () => {
    render(<Shell watchHud={() => () => undefined} />);
    const column = screen.getByText("Tap a place.").parentElement?.parentElement;
    expect(column?.className).toBe(
      "pointer-events-none absolute top-[calc(var(--hud-bottom,5.5rem)+5rem)] left-4 sm:top-[calc(env(safe-area-inset-top)+5.5rem)] flex flex-col items-start gap-3",
    );
  });
});
