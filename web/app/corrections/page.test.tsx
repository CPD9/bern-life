import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import CorrectionsPage from "./page";

test("the corrections page says how each kind of quote is corrected and how to ask", () => {
  render(<CorrectionsPage />);
  expect(screen.getByRole("heading", { level: 1, name: "Corrections and removal" })).toBeTruthy();
  const text = document.body.textContent;
  // The right to ask belongs to the people named, not to anyone.
  expect(text).toContain("gives the people named on a page the right to ask");
  expect(text).toContain("reaches Bern Life with the next snapshot");
  expect(text).toContain("The map's addresses are not in the snapshot");
  expect(text).toContain("A single sentence cannot be left out on its own: its page goes with it.");
  expect(text).toContain("stay in their browser until they remove them");
  // It explains; nothing on it collects or sends anything.
  expect(document.querySelector("form, input, textarea, select, button")).toBeNull();
});
