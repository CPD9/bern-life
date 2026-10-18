import { expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { AgentsApp, type SkillId, loopsText } from "./agents-app";

test("each of Lumi's skills opens its tool, and loops are coming next", () => {
  const tried: SkillId[] = [];
  render(<AgentsApp onTry={(skill) => tried.push(skill)} />);
  fireEvent.click(screen.getByRole("button", { name: "Try: Read a project brief" }));
  fireEvent.click(screen.getByRole("button", { name: "Try: Search Bern experts" }));
  fireEvent.click(screen.getByRole("button", { name: "Try: Make a match report" }));
  expect(tried).toEqual(["brief", "search", "report"]);
  expect(screen.getByText(loopsText)).toBeTruthy();
  expect(screen.getByText("Coming next")).toBeTruthy();
});
