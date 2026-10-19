"use client";

import type { ReactNode } from "react";
import type { SearchResult } from "@/infrastructure/claims";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AskInput } from "./ask-input";
import { BriefInput } from "./brief-input";
import { FixtureLabel } from "./mode-notices";
import { ResultsView } from "./results-view";
import type { InputMode, NavigatorController } from "./use-navigator";

type NavigatorProps = {
  controller: NavigatorController;
  fixtureMode: boolean;
  onShowOnMap?: (response: SearchResponse) => void;
  /** Saves the answer as a match report; false when the browser blocks storage. */
  onMakeReport?: (response: SearchResponse) => boolean;
  /** A control under each result card, such as the Library's save button. */
  renderSave?: ((result: SearchResult) => ReactNode) | undefined;
};

const inputModes: { mode: InputMode; label: string }[] = [
  { mode: "search", label: "Question" },
  { mode: "brief", label: "Project brief" },
];

export function Navigator({
  controller,
  fixtureMode,
  onShowOnMap,
  onMakeReport,
  renderSave,
}: NavigatorProps) {
  const { inputMode, setInputMode } = controller;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-chip rounded-pill flex gap-1 p-1">
          {inputModes.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={inputMode === mode}
              onClick={() => setInputMode(mode)}
              className={`rounded-pill px-4 py-1.5 text-sm font-bold ${
                inputMode === mode ? "bg-panel shadow-panel" : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {fixtureMode && <FixtureLabel />}
      </div>
      {inputMode === "search" ? (
        <AskInput controller={controller} />
      ) : (
        <BriefInput controller={controller} />
      )}
      <ResultsView
        state={controller.state}
        fixtureMode={fixtureMode}
        onRetry={controller.retry}
        onShowOnMap={onShowOnMap}
        onMakeReport={onMakeReport}
        renderSave={renderSave}
      />
    </div>
  );
}
