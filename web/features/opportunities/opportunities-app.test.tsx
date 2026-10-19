import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { abstainedFixture, copyOf, resultFixture } from "@/test/fixtures";
import type { OpportunitiesApi, OpportunitiesOutcome } from "./opportunities-api";
import { OpportunitiesApp } from "./opportunities-app";
import type { OpportunityRequest } from "./opportunity-request";
import { mixedResponse } from "./testing";

function answering(
  outcome: OpportunitiesOutcome,
  sent: OpportunityRequest[] = [],
): OpportunitiesApi {
  return {
    search: async (request) => {
      sent.push(request);
      return outcome;
    },
  };
}

async function ask(query: string) {
  fireEvent.change(screen.getByLabelText("What are you looking for?"), {
    target: { value: query },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
  });
}

describe("OpportunitiesApp", () => {
  test("a starter query searches the opportunity kinds and lists only opportunities", async () => {
    const sent: OpportunityRequest[] = [];
    render(
      <OpportunitiesApp
        fixtureMode
        api={answering({ ok: true, response: mixedResponse() }, sent)}
        renderSave={(result) => <span>slot {result.profile.id}</span>}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Lab or office space for a small team" }));
    });
    expect(sent).toEqual([
      { query: "Lab or office space for a small team", kinds: ["call", "service", "space"] },
    ]);
    expect(screen.getByRole("status").textContent).toBe("1 opportunity");
    expect(screen.getByText("MOCK")).toBeTruthy();
    expect(screen.getByText("slot call-example-demo-seed-grant")).toBeTruthy();
    expect(screen.queryByText("Ada Muster")).toBeNull();
  });

  test("an answer with no opportunities says so", async () => {
    render(
      <OpportunitiesApp
        fixtureMode={false}
        api={answering({ ok: true, response: resultFixture })}
      />,
    );
    await ask("glucose sensors");
    expect(screen.getByRole("status").textContent).toBe(
      "No funding calls, services or spaces matched.",
    );
    expect(screen.queryByText("MOCK")).toBeNull();
  });

  test("an abstention is said plainly", async () => {
    const response = copyOf(abstainedFixture);
    response.abstain_reason = "no_verifiable_source";
    render(<OpportunitiesApp fixtureMode={false} api={answering({ ok: true, response })} />);
    await ask("moon base funding");
    expect(screen.getByRole("status").textContent).toBe(
      "No public page we hold supports an answer to this. We would rather say so than guess.",
    );
  });

  test("a search that is not there yet says it is not connected, without a retry", async () => {
    render(
      <OpportunitiesApp
        fixtureMode={false}
        api={answering({ ok: false, failure: "not_connected" })}
      />,
    );
    await ask("seed funding");
    expect(screen.getByRole("status").textContent).toBe("Opportunity search is not connected yet.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  test("an engine error offers a retry that sends the same request again", async () => {
    const sent: OpportunityRequest[] = [];
    render(
      <OpportunitiesApp
        fixtureMode={false}
        api={answering({ ok: false, failure: "engine_error" }, sent)}
      />,
    );
    await ask("seed funding");
    expect(screen.getByRole("status").textContent).toBe(
      "The search is not answering right now. Try again in a moment.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(sent).toEqual([
      { query: "seed funding", kinds: ["call", "service", "space"] },
      { query: "seed funding", kinds: ["call", "service", "space"] },
    ]);
  });
});
