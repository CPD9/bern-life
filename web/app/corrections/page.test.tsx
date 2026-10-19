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
  // Library items and reports are copies in the visitor's browser, which a new snapshot leaves as
  // they are.
  expect(text).toContain(
    "Sentences someone saved to their Library, and the match reports they made, are copies kept in their own browser that do not change",
  );
  // The private route comes first, as a plain mail link; the public issue is the second option.
  const [mail, repository] = screen
    .getAllByRole("link")
    .filter((link) => /^(mailto:|https:\/\/github\.com)/.test(link.getAttribute("href")!));
  expect([mail!.textContent, mail!.getAttribute("href")]).toEqual([
    "peter.dike@unibe.ch",
    "mailto:peter.dike@unibe.ch",
  ]);
  expect(repository!.getAttribute("href")).toBe("https://github.com/CPD9/bern-life");
  expect(text).not.toContain("hackathon");
  // It explains; nothing on it collects or sends anything.
  expect(document.querySelector("form, input, textarea, select, button")).toBeNull();
});
