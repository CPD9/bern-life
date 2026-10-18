import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { AppEventName, AppEventSink } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchRequest } from "@/infrastructure/engine-types";
import { abstainedFixture, briefFixture, copyOf, resultFixture } from "@/test/fixtures";
import type { NavigatorApi, NavigatorOutcome } from "./navigator-api";
import { Navigator } from "./navigator";
import { useNavigator } from "./use-navigator";

type HarnessProps = {
  api: NavigatorApi;
  fixtureMode?: boolean;
  onMakeReport?: (response: SearchResponse) => boolean;
  events?: AppEventSink;
};

function Harness({ api, fixtureMode = false, onMakeReport, events }: HarnessProps) {
  return (
    <Navigator
      controller={useNavigator(api, events)}
      fixtureMode={fixtureMode}
      {...(onMakeReport ? { onMakeReport } : {})}
    />
  );
}

function answering(response: SearchResponse): NavigatorApi {
  return {
    search: async () => ({ ok: true, response }),
    brief: async () => ({ ok: true, response }),
  };
}

async function ask(query: string) {
  fireEvent.change(screen.getByLabelText("Ask in your words"), { target: { value: query } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
  });
}

describe("Navigator", () => {
  test("a mock answer shows the MOCK banner and the expanded terms as search terms", async () => {
    render(<Harness api={answering(resultFixture)} />);
    await ask("glucose sensors");
    expect(screen.getByRole("status").textContent).toBe("1 result");
    expect(screen.getByText("MOCK")).toBeTruthy();
    expect(screen.getByText(/They are not facts about anyone/)).toBeTruthy();
    expect(screen.getByText("CGM")).toBeTruthy();
  });

  test("a replay answer shows the Replay chip and no MOCK banner", async () => {
    render(<Harness api={answering({ ...copyOf(resultFixture), mode: "replay" })} />);
    await ask("glucose sensors");
    expect(screen.queryByText("MOCK")).toBeNull();
    expect(screen.getByText("Replay · answered from recorded model calls")).toBeTruthy();
  });

  test("an abstained answer says there is no verifiable source, in plain words", async () => {
    render(<Harness api={answering(abstainedFixture)} />);
    await ask("quantum glucose");
    expect(screen.getByRole("status").textContent).toBe(
      "No public page we hold supports an answer to this. We would rather say so than guess.",
    );
    expect(screen.queryByRole("article")).toBeNull();
  });

  test("an engine failure shows a sentence and Try again repeats the same search", async () => {
    const outcomes: NavigatorOutcome[] = [
      { ok: false, failure: { kind: "engine", error: "engine_error" } },
      { ok: true, response: resultFixture },
    ];
    const requests: SearchRequest[] = [];
    const api: NavigatorApi = {
      search: async (request) => {
        requests.push(request);
        return outcomes.shift()!;
      },
      brief: async () => outcomes.shift()!,
    };
    render(<Harness api={api} />);
    await ask("CGM");
    expect(screen.getByRole("status").textContent).toBe(
      "The search is not answering right now. Try again in a moment.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(requests).toEqual([{ query: "CGM" }, { query: "CGM" }]);
    expect(screen.getByRole("status").textContent).toBe("1 result");
  });

  test("a brief shows each need with its sentence and the aspect matrix", async () => {
    render(<Harness api={answering(briefFixture)} />);
    fireEvent.click(screen.getByRole("button", { name: "Project brief" }));
    fireEvent.change(screen.getByLabelText("Or paste the text"), {
      target: { value: "We are developing a wearable glucose sensor." },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Find experts" }));
    });
    expect(
      screen.getByText(
        "From your brief: “We are developing a wearable glucose sensor for people with diabetes.”",
      ),
    ).toBeTruthy();
    const cells = Array.from(document.querySelectorAll("tbody td"), (td) => td.textContent);
    expect(cells).toEqual(["Covered", "Not covered", "Not covered", "Partly"]);
  });

  test("the FIXTURE label shows only in fixture mode", () => {
    const { unmount } = render(<Harness api={answering(resultFixture)} fixtureMode />);
    expect(screen.getByText("FIXTURE data")).toBeTruthy();
    unmount();
    render(<Harness api={answering(resultFixture)} />);
    expect(screen.queryByText("FIXTURE data")).toBeNull();
  });

  test("Make a report hands over the answer on screen, and says so when storage is blocked", async () => {
    const reported: SearchResponse[] = [];
    render(
      <Harness
        api={answering(resultFixture)}
        onMakeReport={(response) => {
          reported.push(response);
          return false;
        }}
      />,
    );
    await ask("glucose sensors");
    fireEvent.click(screen.getByRole("button", { name: "Make a report" }));
    expect(reported).toEqual([resultFixture]);
    expect(screen.getByRole("alert").textContent).toBe(
      "This browser blocks storage, so the report could not be kept.",
    );
  });

  test("no Make a report without a handler or for an abstained answer", async () => {
    const { unmount } = render(<Harness api={answering(resultFixture)} />);
    await ask("glucose sensors");
    expect(screen.queryByRole("button", { name: "Make a report" })).toBeNull();
    unmount();
    render(<Harness api={answering(abstainedFixture)} onMakeReport={() => true} />);
    await ask("quantum origami");
    expect(screen.queryByRole("button", { name: "Make a report" })).toBeNull();
  });

  test("answers become story events through the injected sink", async () => {
    const heard: AppEventName[] = [];
    const sink = { emit: (name: AppEventName) => void heard.push(name) };
    const { unmount } = render(<Harness api={answering(resultFixture)} events={sink} />);
    await ask("Glukosesensoren für Kinder");
    expect(heard).toEqual(["search_answered", "search_answered_other_language"]);
    unmount();
    render(<Harness api={answering(abstainedFixture)} events={sink} />);
    await ask("Prof. Nobody");
    expect(heard).toEqual(["search_answered", "search_answered_other_language", "abstained_seen"]);
  });
});
