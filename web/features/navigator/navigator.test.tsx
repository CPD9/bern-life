import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AppEventName, AppEventSink } from "@/infrastructure/app-events";
import type { SearchResult } from "@/infrastructure/claims";
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
  renderSave?: (result: SearchResult) => ReactNode;
  events?: AppEventSink;
};

function Harness({ api, fixtureMode = false, onMakeReport, renderSave, events }: HarnessProps) {
  return (
    <Navigator
      controller={useNavigator(api, events)}
      fixtureMode={fixtureMode}
      {...(onMakeReport ? { onMakeReport } : {})}
      {...(renderSave ? { renderSave } : {})}
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

async function submitBrief(text: string) {
  fireEvent.click(screen.getByRole("button", { name: "Project brief" }));
  fireEvent.change(screen.getByLabelText("Or paste the text"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Find experts" }));
  });
}

describe("Navigator", () => {
  test("a mock answer in fixture mode shows the MOCK banner and the expanded terms", async () => {
    render(<Harness api={answering(resultFixture)} fixtureMode />);
    await ask("glucose sensors");
    expect(screen.getByRole("status").textContent).toBe("1 result");
    expect(screen.getByText("MOCK")).toBeTruthy();
    expect(screen.queryByText(/plain search over the stored pages/)).toBeNull();
    expect(screen.getByText(/They are not facts about anyone/)).toBeTruthy();
    expect(screen.getByText("CGM")).toBeTruthy();
  });

  test("a mock answer from the engine says plain search, with no MOCK banner", async () => {
    render(<Harness api={answering(resultFixture)} />);
    await ask("glucose sensors");
    expect(screen.queryByText("MOCK")).toBeNull();
    expect(screen.queryByText(/canned test data/)).toBeNull();
    expect(
      screen.getByText(
        "No recorded model answer for this question: plain search over the stored pages",
      ),
    ).toBeTruthy();
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

  test("the controller decides which input shows, so an agent can open the brief", () => {
    function Driven() {
      const controller = useNavigator(answering(resultFixture));
      return (
        <>
          <button type="button" onClick={() => controller.setInputMode("brief")}>
            Read a brief
          </button>
          <Navigator controller={controller} fixtureMode={false} />
        </>
      );
    }
    render(<Driven />);
    expect(screen.getByLabelText("Ask in your words")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Read a brief" }));
    expect(screen.getByLabelText("Or paste the text")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Project brief" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  test("a brief shows each need with its sentence and the aspect matrix", async () => {
    render(<Harness api={answering(briefFixture)} />);
    await submitBrief("We are developing a wearable glucose sensor.");
    expect(
      screen.getByText(
        "From your brief: “We are developing a wearable glucose sensor for people with diabetes.”",
      ),
    ).toBeTruthy();
    const cells = Array.from(document.querySelectorAll("tbody td"), (td) => td.textContent);
    expect(cells).toEqual(["Covered", "Not covered", "Not covered", "Partly"]);
  });

  test("a brief the replay could not read says it needs the model, not that no page supports it", async () => {
    const unread: SearchResponse = {
      ...copyOf(abstainedFixture),
      query: "",
      mode: "mock",
      brief_terms: [],
    };
    render(<Harness api={answering(unread)} />);
    await submitBrief("We are developing a wearable glucose sensor.");
    expect(screen.getByRole("status").textContent).toBe(
      "Reading a new brief needs the model; this replay has the recorded briefs only.",
    );
    expect(screen.queryByText(/plain search over the stored pages/)).toBeNull();
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

  test("the save slot sits under each result card, given that card's result", async () => {
    const shown: string[] = [];
    render(
      <Harness
        api={answering(resultFixture)}
        renderSave={(result) => {
          shown.push(result.profile.id);
          return <button type="button">Keep {result.profile.name.value}</button>;
        }}
      />,
    );
    await ask("glucose sensors");
    expect([...new Set(shown)]).toEqual(resultFixture.results.map((result) => result.profile.id));
    for (const result of resultFixture.results) {
      const name = result.profile.name.value;
      const item = screen.getByRole("button", { name: `Keep ${name}` }).closest("li")!;
      expect(item.querySelector("article, section, div")?.textContent).toContain(name);
    }
  });

  test("no save slot without a renderer", async () => {
    render(<Harness api={answering(resultFixture)} />);
    await ask("glucose sensors");
    expect(screen.queryByRole("button", { name: /^Keep / })).toBeNull();
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

  test("show() puts an answer on screen without asking the engine or telling the story", () => {
    const heard: AppEventName[] = [];
    const asked: string[] = [];
    const api: NavigatorApi = {
      search: async (request) => {
        asked.push(request.query);
        return { ok: true, response: resultFixture };
      },
      brief: async () => ({ ok: true, response: briefFixture }),
    };
    function Shown() {
      const controller = useNavigator(api, { emit: (name) => void heard.push(name) });
      return (
        <>
          <button type="button" onClick={() => controller.show(resultFixture)}>
            Show the answer
          </button>
          <Navigator controller={controller} fixtureMode={false} />
        </>
      );
    }
    render(<Shown />);
    // Left on the brief form, the answer still shows under the question it answers.
    fireEvent.click(screen.getByRole("button", { name: "Project brief" }));
    act(() => fireEvent.click(screen.getByRole("button", { name: "Show the answer" })));
    expect(screen.getByRole("button", { name: "Question" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    const name = resultFixture.results[0]!.profile.name.value;
    expect(screen.getByRole("status").textContent).toBe("1 result");
    expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Ask in your words") as HTMLInputElement).value).toBe(
      resultFixture.query,
    );
    expect([heard, asked]).toEqual([[], []]);
  });

  test("show() leaves a brief for the question it answers, and a late brief answer stays away", async () => {
    let answerBrief: (outcome: NavigatorOutcome) => void = () => undefined;
    const api: NavigatorApi = {
      search: async () => ({ ok: true, response: resultFixture }),
      brief: () => new Promise((resolve) => (answerBrief = resolve)),
    };
    function Shown() {
      const controller = useNavigator(api, { emit: () => undefined });
      return (
        <>
          <button type="button" onClick={() => controller.show(resultFixture)}>
            Show the answer
          </button>
          <Navigator controller={controller} fixtureMode={false} />
        </>
      );
    }
    render(<Shown />);
    await submitBrief("We build glucose sensors for children.");
    expect(screen.getByRole("status").textContent).toBe("Reading your brief…");
    act(() => fireEvent.click(screen.getByRole("button", { name: "Show the answer" })));
    expect(screen.getByRole("button", { name: "Question" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.queryByLabelText("Or paste the text")).toBeNull();
    expect((screen.getByLabelText("Ask in your words") as HTMLInputElement).value).toBe(
      resultFixture.query,
    );
    await act(async () => answerBrief({ ok: true, response: briefFixture }));
    expect(screen.getByRole("status").textContent).toBe("1 result");
    expect(screen.queryByRole("button", { name: "Find experts" })).toBeNull();
  });
});
