import { expect, test } from "bun:test";
import { formatBernDate, formatBernShortDate, formatBernTime } from "./bern-time";

test("formats an instant in Bern summer time", () => {
  const instant = new Date("2026-10-18T12:05:00Z");
  expect(formatBernTime(instant)).toBe("14:05");
  expect(formatBernDate(instant)).toBe("Sunday 18 October");
  expect(formatBernShortDate(instant)).toBe("Sun 18 Oct");
});

test("follows the switch to winter time on 25 October", () => {
  expect(formatBernTime(new Date("2026-10-25T00:30:00Z"))).toBe("02:30");
  expect(formatBernTime(new Date("2026-10-25T01:30:00Z"))).toBe("02:30");
  expect(formatBernTime(new Date("2026-10-25T12:00:00Z"))).toBe("13:00");
});
