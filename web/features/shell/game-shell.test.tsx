import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { GameShell, type WorldView } from "./game-shell";

function Shell(props: { floatieHidden?: boolean; view?: WorldView }) {
  return (
    <GameShell
      view="map"
      phoneOpen={false}
      onSelectTab={() => undefined}
      hud={null}
      side={null}
      canvas={<button type="button">A place</button>}
      floatie={<button type="button">Lumi, your agent</button>}
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
    expect(screen.getByRole("button", { name: "Lumi, your agent" })).toBeTruthy();
  });

  test("while hidden, the floatie is out of sight and out of the tab order", () => {
    shell({ floatieHidden: true });
    expect(screen.queryByRole("button", { name: "Lumi, your agent" })).toBeNull();
    const floatie = screen.getByText("Lumi, your agent");
    expect(floatie.parentElement?.hidden).toBe(true);
  });

  test("a floatie hidden while it holds focus hands focus to the tab of the view on screen", () => {
    const view = render(<Shell view="home" />);
    screen.getByRole("button", { name: "Lumi, your agent" }).focus();
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
});
