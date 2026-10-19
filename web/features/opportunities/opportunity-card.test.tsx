import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { SearchResult } from "@/infrastructure/claims";
import { OpportunityCard } from "./opportunity-card";
import { callResult, demoAmount, demoDeadline } from "./testing";

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

function quotedText(container: HTMLElement): string {
  return Array.from(container.querySelectorAll("mark"), (mark) => mark.textContent).join("\n");
}

describe("OpportunityCard", () => {
  test("an amount and a deadline appear only inside their quoted sentences", () => {
    const { container } = render(<OpportunityCard result={callResult()} />);
    const all = container.textContent ?? "";
    for (const value of [demoAmount, demoDeadline]) {
      expect(occurrences(all, value)).toBe(1);
      expect(occurrences(quotedText(container), value)).toBe(1);
    }
    expect(screen.getByText(`“Grants of up to ${demoAmount} per project.”`).tagName).toBe("MARK");
    expect(screen.getByText(`“Applications close on ${demoDeadline}.”`).tagName).toBe("MARK");
  });

  test("other fields keep their claims, and the save slot gets the result", () => {
    const seen: SearchResult[] = [];
    render(
      <OpportunityCard
        result={callResult()}
        renderSave={(result) => {
          seen.push(result);
          return <button type="button">Keep it</button>;
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Example Funder" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeTruthy();
    expect(seen.map((result) => result.profile.id)).toEqual(["call-example-demo-seed-grant"]);
    expect(seen[0]?.profile.fields.amount?.[0]?.value).toBe(demoAmount);
  });
});
