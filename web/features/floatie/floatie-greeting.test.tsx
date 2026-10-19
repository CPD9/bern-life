import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { FloatieGreeting } from "./floatie-greeting";
import { greetingLines, nextLine } from "./lumi-lines";

function greet(name: string) {
  render(
    <FloatieGreeting
      name={name}
      figure={(onSelect) => (
        <button type="button" onClick={onSelect}>
          {name}
        </button>
      )}
    />,
  );
  return {
    said: () => screen.getByText(/./, { selector: "p" }).textContent,
    tap: () => fireEvent.click(screen.getByRole("button", { name })),
  };
}

describe("FloatieGreeting", () => {
  test("Lumi greets first, and each tap moves to the next line and back round", () => {
    const { said, tap } = greet("Lumi");
    expect(said()).toBe(
      "Hi, I'm Lumi! I find the right people in Bern for you, each with the sentence that proves it.",
    );
    tap();
    expect(said()).toBe(
      "First, a few questions about you. At the end you choose my name and my bear.",
    );
    tap();
    expect(said()).toBe("Once you're in, open Ask on your phone and I'll search for you.");
    tap();
    expect(said()).toBe(greetingLines("Lumi")[0]);
  });

  test("a renamed agent greets in its own name", () => {
    const { said } = greet("Bärli");
    expect(said()).toBe(
      "Hi, I'm Bärli! I find the right people in Bern for you, each with the sentence that proves it.",
    );
  });
});

describe("nextLine", () => {
  test("it counts through the lines and wraps to the first", () => {
    expect([0, 1, 2].map((index) => nextLine(index, 3))).toEqual([1, 2, 0]);
  });
});
