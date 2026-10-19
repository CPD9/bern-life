"use client";

import type { ReactNode } from "react";
import { GarageApp } from "@/features/garage/garage-app";
import { LibraryApp } from "@/features/library/library-app";
import {
  type LibraryItem,
  entryFromResult,
  savedEventNames,
} from "@/features/library/library-items";
import { SaveButton } from "@/features/library/save-button";
import { OpportunitiesApp } from "@/features/opportunities/opportunities-app";
import type { AppEventSink } from "@/infrastructure/app-events";
import type { SearchResult } from "@/infrastructure/claims";

// Apps the phone and the desk share, and the story events their callbacks stand for. The features
// only report what happened (a save, a visit); the app turns that into the story's events.

/** A save completes "keep it in your library", and "save an opportunity" when it is one. */
export function emitSaved(events: AppEventSink): (item: LibraryItem) => void {
  return (item) => {
    for (const name of savedEventNames(item)) events.emit(name);
  };
}

/**
 * The Library's save button under a result card, in Ask, the Navigator and Opportunities. Under
 * DEMO_FIXTURES every result is invented, so there is no button: the Library would keep made-up
 * people and calls beside real ones, and a save would count for the story.
 */
export function saveControl(
  events: AppEventSink,
  fixtureMode: boolean,
): ((result: SearchResult) => ReactNode) | undefined {
  if (fixtureMode) return undefined;
  const onSaved = emitSaved(events);
  return function SaveControl(result) {
    return <SaveButton entry={entryFromResult(result)} onSaved={onSaved} />;
  };
}

export function opportunitiesApp(fixtureMode: boolean, events: AppEventSink): ReactNode {
  return (
    <OpportunitiesApp
      fixtureMode={fixtureMode}
      events={events}
      renderSave={saveControl(events, fixtureMode)}
    />
  );
}

export function libraryApp(): ReactNode {
  return <LibraryApp />;
}

/** The garage reports a visit once it opens, and numbers only when the engine measured them. */
export function garageApp(fixtureMode: boolean, events: AppEventSink): ReactNode {
  return (
    <GarageApp
      fixtureMode={fixtureMode}
      onVisited={() => events.emit("garage_visited")}
      onNumbersSeen={() => events.emit("numbers_seen")}
    />
  );
}
