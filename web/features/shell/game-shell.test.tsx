import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { GameShell } from "./game-shell";

function shell(props: { floatieHidden?: boolean } = {}) {
  return render(
    <GameShell
      view="map"
      phoneOpen={false}
      onSelectTab={() => undefined}
      hud={null}
      side={null}
      canvas={null}
      floatie={<button type="button">Lumi, your agent</button>}
      {...props}
      overlay={null}
    />,
  );
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
});
