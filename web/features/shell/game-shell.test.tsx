import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { GameShell, type WorldView } from "./game-shell";

function floatieClasses(view: WorldView): string[] {
  const { container } = render(
    <GameShell
      view={view}
      phoneOpen={false}
      onSelectTab={() => undefined}
      hud={null}
      side={null}
      canvas={null}
      floatie={<button type="button">Lumi</button>}
      overlay={null}
    />,
  );
  return container.querySelector("[data-floatie]")!.className.split(" ");
}

describe("the floatie", () => {
  test("in the office it shows at every width", () => {
    expect(floatieClasses("home")).not.toContain("hidden");
  });

  test("on the map it gives way to the place panel on a phone and shows from sm up", () => {
    const classes = floatieClasses("map");
    expect(classes).toContain("hidden");
    expect(classes).toContain("sm:block");
  });
});
