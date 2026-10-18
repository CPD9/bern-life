import { expect, test } from "bun:test";
import { fragmentUrl } from "./text-fragment";

test("encodes commas, ampersands, hyphens and umlauts in the text directive", () => {
  expect(
    fragmentUrl(
      "https://www.example-institute.test/team/ada#bio",
      "Sensoren, Pumpen & Algorithmen für Kinder-Diabetes",
    ),
  ).toBe(
    "https://www.example-institute.test/team/ada#:~:text=Sensoren%2C%20Pumpen%20%26%20Algorithmen%20f%C3%BCr%20Kinder%2DDiabetes",
  );
});

test("collapses whitespace inside the span", () => {
  expect(fragmentUrl("https://example.test/a", " Sensor\n  Lab ")).toBe(
    "https://example.test/a#:~:text=Sensor%20Lab",
  );
});
