import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SearchSummary } from "./search-summary";

describe("SearchSummary", () => {
  test("on a phone it sits under the HUD's measured bottom; from sm up where it was", () => {
    render(
      <SearchSummary state={{ status: "searching" }} lighting={null} onClear={() => undefined} />,
    );
    const bar = screen.getByText("Searching…").parentElement;
    expect(bar?.className).toBe(
      "pointer-events-none absolute inset-x-0 top-[calc(var(--hud-bottom,5.5rem)+0.5rem)] z-20 sm:top-20 flex justify-center px-4",
    );
  });
});
