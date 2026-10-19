import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { copyOf, healthFixture } from "@/test/fixtures";
import { Hud } from "./hud";
import { hudCounts } from "./hud-items";
import { loadHealth } from "./use-health";

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
      <Hud
        now={null}
        health={{ status: "waiting" }}
        goal="Explore"
        account={{ status: "checking" }}
      />,
    );
    expect(container.textContent).toBe("Bern LifeGoal Explore");
    expect(container.textContent).not.toMatch(/\d/);
  });

  test("shows Bern time, the goal, the counts and the mode from health", () => {
    const { container } = render(
      <Hud
        now={new Date("2026-10-18T12:05:00Z")}
        health={{ status: "ok", health: healthFixture }}
        goal="Explore"
        account={{ status: "checking" }}
      />,
    );
    container.querySelector("[popover]")?.remove();
    expect(container.textContent).toBe(
      "Bern LifeSun 18 Oct · 14:05Goal Explore2 profiles indexed · 1 sourceSample data",
    );
  });

  test("the bell sits in the HUD when the app passes one", () => {
    render(
      <Hud
        now={null}
        health={{ status: "waiting" }}
        goal="Explore"
        account={{ status: "checking" }}
        bell={<button type="button">Notifications</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  const withMode = (mode: "live" | "replay" | "mock") => ({
    status: "ok" as const,
    health: { ...copyOf(healthFixture), mode, snapshot: "2026-10-18" },
  });

  test("names the answer source in plain words, and says Offline when the engine is down", () => {
    const chip = (health: Parameters<typeof Hud>[0]["health"]) => {
      const view = render(
        <Hud now={null} health={health} goal="Explore" account={{ status: "checking" }} />,
      );
      const label = view.container.querySelector("[popovertarget]")?.textContent ?? null;
      view.unmount();
      return label;
    };
    expect(chip(withMode("live"))).toBe("Live");
    expect(chip(withMode("replay"))).toBe("Recorded");
    expect(chip(withMode("mock"))).toBe("Your words only");
    expect(chip({ status: "offline" })).toBe("Offline");
    expect(chip({ status: "waiting" })).toBeNull();
  });

  test("tapping the chip opens the plain explanation", () => {
    render(
      <Hud
        now={null}
        health={withMode("replay")}
        goal="Explore"
        account={{ status: "checking" }}
      />,
    );
    const chip = screen.getByRole("button", { name: "Recorded" });
    const popover = document.getElementById(chip.getAttribute("popovertarget")!)!;
    expect(popover.getAttribute("popover")).toBe("auto");
    expect(popover.textContent).toBe(
      "RecordedApertus's search terms for this question were recorded earlier; the search itself ran just now over the stored pages.This question is one of a set whose Apertus calls were recorded in advance, so no model ran today. The search used those recorded terms over the stored public pages just now. Every fact shown is a quoted span on a stored public page, with a link to the page it came from.",
    );
  });
});

describe("loadHealth", () => {
  test("an answer is health; an error status or a failed request is offline", async () => {
    expect(await loadHealth(async () => Response.json(healthFixture))).toEqual({
      status: "ok",
      health: healthFixture,
    });
    expect(
      await loadHealth(async () => Response.json({ error: "engine_error" }, { status: 502 })),
    ).toEqual({ status: "offline" });
    expect(
      await loadHealth(async () => {
        throw new TypeError("network down");
      }),
    ).toEqual({ status: "offline" });
  });
});
