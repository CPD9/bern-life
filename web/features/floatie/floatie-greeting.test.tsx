import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { FloatieGreeting } from "./floatie-greeting";
import { greetingLines, nextLine } from "./lumi-lines";

describe("FloatieGreeting", () => {
  test("Lumi greets first, and each tap moves to the next line and back round", () => {
    render(
      <FloatieGreeting
        figure={(onSelect) => (
          <button type="button" onClick={onSelect}>
            Lumi
          </button>
        )}
      />,
    );
    const said = () => screen.getByText(/./, { selector: "p" }).textContent;
    const tap = () => fireEvent.click(screen.getByRole("button", { name: "Lumi" }));

    expect(said()).toBe(
      "Hi, I'm Lumi! I'll help you find the right people in Bern, each with the sentence that proves it.",
    );
    tap();
    expect(said()).toBe("First, tell me a little about you. You can change any answer later.");
    tap();
    tap();
    expect(said()).toBe(greetingLines[0]);
  });
});

describe("nextLine", () => {
  test("it counts through three lines and wraps to the first", () => {
    expect([0, 1, 2].map(nextLine)).toEqual([1, 2, 0]);
  });
});
