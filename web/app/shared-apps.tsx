"use client";

import type { ReactNode } from "react";
import { GarageApp } from "@/features/garage/garage-app";
import { LibraryApp } from "@/features/library/library-app";
import {
  type LibraryItem,
  entryFromResult,
  savedEventNames,
} from "@/features/library/library-items";
import type { LibraryStore } from "@/features/library/library-store";
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

export type SaveInput = {
  fixtureMode: boolean;
  events: AppEventSink;
  /** The Library's store; the browser's own when absent. */
  library?: LibraryStore | undefined;
};

type SaveSlot = { renderSave?: (result: SearchResult) => ReactNode };

/** The Library's save button under a result card, in Ask, the Navigator and Opportunities. None in
 *  fixture mode: every person and call there is invented and has no place in a real library. */
export function saveSlot({ fixtureMode, events, library }: SaveInput): SaveSlot {
  if (fixtureMode) return {};
  const onSaved = emitSaved(events);
  const store = library ? { store: library } : {};
  return {
    renderSave: function SaveControl(result) {
      return <SaveButton entry={entryFromResult(result)} onSaved={onSaved} {...store} />;
    },
  };
}

export function opportunitiesApp(save: SaveInput): ReactNode {
  return (
    <OpportunitiesApp fixtureMode={save.fixtureMode} events={save.events} {...saveSlot(save)} />
  );
}

export function libraryApp(library?: LibraryStore): ReactNode {
  return library ? <LibraryApp store={library} /> : <LibraryApp />;
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
