import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { type ReactElement, type ReactNode, cloneElement } from "react";
import { parseNumbers } from "@/features/garage/numbers";
import type { NumbersOutcome } from "@/features/garage/numbers-api";
import { numbersBody, queuedApi } from "@/features/garage/testing";
import { browserLibrary } from "@/features/library/library-store";
import { callResult } from "@/features/opportunities/testing";
import type { OpportunitiesAppProps } from "@/features/opportunities/opportunities-app";
import { createSettleStore } from "@/features/settle/settle-store";
import type { AppEventName } from "@/infrastructure/app-events";
import { resultFixture } from "@/test/fixtures";
import { garageApp, opportunitiesApp } from "./shared-apps";
import { useWorldSettle } from "./world-settle";

// Each story event fires on the real action it stands for, and once.

function recorder() {
  const emitted: AppEventName[] = [];
  return { emitted, events: { emit: (name: AppEventName) => void emitted.push(name) } };
}

describe("saving from Opportunities", () => {
  beforeEach(() => {
    for (const item of browserLibrary().get()) browserLibrary().remove(item);
  });

  function saveControl(result: Parameters<NonNullable<OpportunitiesAppProps["renderSave"]>>[0]) {
    const { emitted, events } = recorder();
    const app = opportunitiesApp(false, events) as ReactElement<OpportunitiesAppProps>;
    render(<>{app.props.renderSave!(result)}</>);
    return emitted;
  }

  test("an opportunity counts as an opportunity and a library item, once", () => {
    const emitted = saveControl(callResult());
    expect(emitted).toEqual([]);
    act(() => fireEvent.click(screen.getByRole("button", { name: /^Save to library/ })));
    expect(emitted).toEqual(["library_item_saved", "opportunity_saved"]);
    act(() => fireEvent.click(screen.getByRole("button", { name: /^Saved/ })));
    expect(emitted).toEqual(["library_item_saved", "opportunity_saved"]);
  });

  test("a person counts as a library item only", () => {
    const emitted = saveControl(resultFixture.results[0]!);
    act(() => fireEvent.click(screen.getByRole("button", { name: /^Save to library/ })));
    expect(emitted).toEqual(["library_item_saved"]);
  });
});

describe("the garage", () => {
  const measured = parseNumbers(numbersBody())!;

  function openGarage(
    fixtureMode: boolean,
    outcome: NumbersOutcome = { status: "ok", numbers: measured },
  ) {
    const { emitted, events } = recorder();
    const api = queuedApi([outcome]);
    const garage = cloneElement(garageApp(fixtureMode, events) as ReactElement<{ api: unknown }>, {
      api,
    });
    const view = render(garage);
    return { emitted, rerender: () => view.rerender(garage) };
  }

  test("opening it is a visit, and the engine's numbers on screen are seen, each once", async () => {
    const { emitted, rerender } = openGarage(false);
    await screen.findByText("demo-model-large");
    rerender();
    expect(emitted).toEqual(["garage_visited", "numbers_seen"]);
  });

  test("fixture numbers are a visit, never numbers seen", async () => {
    const { emitted } = openGarage(true);
    await screen.findByText("demo-model-large");
    expect(emitted).toEqual(["garage_visited"]);
  });

  test("before /api/numbers answers (not connected yet) it is a visit, never numbers seen", async () => {
    const { emitted } = openGarage(false, { status: "not_connected" });
    await screen.findByText("The numbers are not connected yet.");
    expect(emitted).toEqual(["garage_visited"]);
  });

  test("numbers that failed to load are a visit, never numbers seen", async () => {
    const { emitted } = openGarage(false, { status: "error" });
    await screen.findByText("The numbers could not be loaded.");
    expect(emitted).toEqual(["garage_visited"]);
  });
});

describe("settling", () => {
  function memoryStore() {
    const items = new Map<string, string>();
    return createSettleStore(() => ({
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => void items.set(key, value),
    }));
  }

  test("choosing a plot reports settled once, and the plot is kept", () => {
    const { emitted, events } = recorder();
    const store = memoryStore();
    const { result } = renderHook(() => useWorldSettle(events, () => store));
    expect(result.current.plot).toBeNull();
    act(() => result.current.open());
    const { rerender } = render(<>{result.current.dialog as ReactNode}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Settle in Altstadt" })));
    expect(emitted).toEqual(["settled"]);
    rerender(<>{result.current.dialog as ReactNode}</>);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Your office is here" })));
    expect(emitted).toEqual(["settled"]);
    expect(result.current.plot?.district).toBe("Altstadt");
    expect(store.get()?.id).toBe("altstadt");
  });

  test("the dialog is mounted only while it is open", () => {
    const { result } = renderHook(() => useWorldSettle(recorder().events, () => memoryStore()));
    expect(result.current.dialog).toBe(false);
    act(() => result.current.open());
    expect(result.current.dialog).not.toBe(false);
  });
});
