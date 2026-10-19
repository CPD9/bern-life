import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { NumbersApi } from "@/infrastructure/numbers-api";
import { parseNumbers } from "@/infrastructure/numbers";
import { numbersBody, queuedApi } from "@/test/numbers";
import { CaseStepApp } from "./case-step-app";
import { alarmQuestion, caseSteps } from "./case-steps";

const pending: NumbersApi = { numbers: () => new Promise(() => undefined) };
const measured = () => queuedApi([{ status: "ok", numbers: parseNumbers(numbersBody())! }]);

const asked: string[] = [];
const opened: string[] = [];

beforeEach(() => {
  asked.length = 0;
  opened.length = 0;
});

function show(number: number, api: NumbersApi = pending, fixtureMode = false) {
  const step = caseSteps.find((candidate) => candidate.number === number)!;
  return render(
    <CaseStepApp
      step={step}
      fixtureMode={fixtureMode}
      onAsk={(query) => asked.push(query)}
      onOpenApp={(appId) => opened.push(appId)}
      api={api}
    />,
  );
}

describe("CaseStepApp", () => {
  test("step 1 says where it is, what the case asks, and what to look for", () => {
    show(1);
    expect(screen.getByText("Step 1 of 7")).toBeTruthy();
    expect(screen.getByText(/at least 80% of the expected experts or units/)).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "What to look for" })).getAllByRole("listitem"),
    ).toHaveLength(1);
    expect(screen.getByText("Loading the numbers.")).toBeTruthy();
  });

  test("Try it asks the exact recorded question", () => {
    show(1);
    fireEvent.click(screen.getByRole("button", { name: "Try it" }));
    expect(asked).toEqual([alarmQuestion]);
    expect(opened).toEqual([]);
  });

  test("step 2 offers the other wordings after the first", () => {
    show(2);
    fireEvent.click(screen.getByRole("button", { name: "Try it" }));
    fireEvent.click(screen.getByRole("button", { name: "CGM" }));
    fireEvent.click(screen.getByRole("button", { name: "Blutzucker messen" }));
    expect(asked).toEqual(["glucose sensors", "CGM", "Blutzucker messen"]);
  });

  test("step 6's Try it opens Sources", () => {
    show(6);
    fireEvent.click(screen.getByRole("button", { name: "Try it" }));
    expect(opened).toEqual(["sources"]);
    expect(asked).toEqual([]);
  });

  test("Next and Back open the neighbouring steps; the ends have one button", () => {
    const first = show(1);
    const steps = () => within(screen.getByRole("navigation", { name: "Steps" }));
    expect(steps().queryByRole("button", { name: "Back" })).toBeNull();
    fireEvent.click(steps().getByRole("button", { name: "Next: 2 Wording" }));
    first.unmount();
    show(2);
    fireEvent.click(steps().getByRole("button", { name: "Back" }));
    fireEvent.click(steps().getByRole("button", { name: "Next: 3 Proof" }));
    expect(opened).toEqual(["case-2", "case-1", "case-3"]);
  });

  test("the last step has no Next", () => {
    show(7);
    const steps = within(screen.getByRole("navigation", { name: "Steps" }));
    expect(steps.getAllByRole("button").map((button) => button.textContent)).toEqual(["Back"]);
  });

  test("the measured number, the bar and the verdict, as the engine reports them", async () => {
    await act(async () => show(1, measured()));
    const region = within(screen.getByRole("region", { name: "Measured" }));
    expect(region.getByText("Measured by the evaluator on 48 queries, snapshot demo-snapshot-1."));
    expect(region.getByText("Recall@10").nextElementSibling?.textContent).toBe(
      "0.4375 [0.29, 0.58]",
    );
    expect(region.getByText(/the case asks for/).textContent).toBe(
      "Not met: the case asks for at least 0.8.",
    );
  });

  test("fixture numbers are marked FIXTURE and get no verdict", async () => {
    await act(async () => show(3, measured(), true));
    const region = within(screen.getByRole("region", { name: "Measured" }));
    expect(region.getByText(/FIXTURE/)).toBeTruthy();
    expect(region.getByText("Traceable claims").nextElementSibling?.textContent).toBe("812 / 812");
    expect(region.queryByText(/Met/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/measured by/i);
  });

  test("a step the evaluator does not measure says so", async () => {
    await act(async () => show(4, measured()));
    expect(screen.getByText("The evaluator measures no number for this step.")).toBeTruthy();
  });

  test("a failed load offers Try again, which asks once more", async () => {
    const api = queuedApi([
      { status: "error" },
      { status: "ok", numbers: parseNumbers(numbersBody())! },
    ]);
    await act(async () => show(7, api));
    expect(screen.getByText("The numbers could not be loaded.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(screen.getByText("Invented questions abstained").nextElementSibling?.textContent).toBe(
      "7 / 10",
    );
    expect(api.calls()).toBe(2);
  });
});
