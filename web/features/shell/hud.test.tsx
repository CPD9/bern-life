import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { copyOf, healthFixture } from "@/test/fixtures";
import { Hud } from "./hud";
import { hudCounts } from "./hud-items";

describe("hudCounts", () => {
  test("lists only the counts the health response states", () => {
    expect(hudCounts(healthFixture)).toEqual(["2 profiles indexed", "1 source"]);
    const onlyProfiles = copyOf(healthFixture);
    onlyProfiles.counts = { profiles: 1234 };
    expect(hudCounts(onlyProfiles)).toEqual(["1,234 profiles indexed"]);
    expect(hudCounts(null)).toEqual([]);
  });
});

describe("Hud", () => {
  test("shows no number at all when neither the clock nor health has answered", () => {
    const { container } = render(
      <Hud now={null} health={null} goal="Explore" account={{ status: "checking" }} />,
    );
    expect(container.textContent).toBe("Bern LifeGoal Explore");
    expect(container.textContent).not.toMatch(/\d/);
  });

  test("shows Bern time, the goal, the counts and the mode from health", () => {
    const { container } = render(
      <Hud
        now={new Date("2026-10-18T12:05:00Z")}
        health={healthFixture}
        goal="Explore"
        account={{ status: "checking" }}
      />,
    );
    expect(container.textContent).toBe(
      "Bern LifeSun 18 Oct · 14:05Goal Explore2 profiles indexed · 1 sourceMOCK",
    );
  });

  test("the bell sits in the HUD when the app passes one", () => {
    render(
      <Hud
        now={null}
        health={null}
        goal="Explore"
        account={{ status: "checking" }}
        bell={<button type="button">Notifications</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  });
});
