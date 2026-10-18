import { expect, test } from "bun:test";
import { highlightParts } from "./highlight";

test("marks topics regardless of case and accents, keeping the page's own characters", () => {
  expect(
    highlightParts("Glukosesensoren für Kinder, Blutzucker-Messung", ["glukosesensor", "fur"]),
  ).toEqual([
    { text: "Glukosesensor", marked: true },
    { text: "en ", marked: false },
    { text: "für", marked: true },
    { text: " Kinder, Blutzucker-Messung", marked: false },
  ]);
});

test("overlapping terms merge into one mark and short terms are ignored", () => {
  expect(
    highlightParts("continuous glucose monitoring", ["glucose", "glucose monitoring", "g"]),
  ).toEqual([
    { text: "continuous ", marked: false },
    { text: "glucose monitoring", marked: true },
  ]);
});

test("no term found leaves the sentence whole", () => {
  expect(highlightParts("Sensor Lab", ["robotics"])).toEqual([
    { text: "Sensor Lab", marked: false },
  ]);
});
