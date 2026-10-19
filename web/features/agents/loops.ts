// A loop is a saved search that the player runs again by hand. Each run keeps the ids, names and
// source links of its results, so the next run can list what is new and what dropped out without
// keeping whole responses. All of it is pure; the store and the screen call these functions.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { maxQueryLength } from "@/infrastructure/search-request";
import { type Kind, allKinds, kindNames } from "./kinds";

export type LoopEntry = {
  readonly id: string;
  readonly name: string;
  readonly kind: Kind;
  readonly href: string;
};

export type LoopRun = {
  readonly snapshot: string;
  readonly mock: boolean;
  readonly entries: readonly LoopEntry[];
};

export type Change = { readonly type: "new" | "dropped"; readonly entry: LoopEntry };

export type Loop = {
  readonly id: string;
  readonly query: string;
  /** Empty means every kind. */
  readonly kinds: readonly Kind[];
  readonly last: LoopRun | null;
  /** What the last run changed against the run before it; null until there are two runs. */
  readonly changes: readonly Change[] | null;
};

export type AgentNotice = { readonly title: string; readonly body: string; readonly href: string };

function cleanQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function sortedKinds(kinds: readonly Kind[]): Kind[] {
  return allKinds.filter((kind) => kinds.includes(kind));
}

/** The same words and kinds are the same loop, whatever the case or order they were typed in. */
export function loopId(query: string, kinds: readonly Kind[]): string {
  return `${cleanQuery(query).toLowerCase()}|${sortedKinds(kinds).join(",")}`;
}

export function makeLoop(query: string, kinds: readonly Kind[]): Loop | null {
  const clean = cleanQuery(query);
  if (clean === "" || clean.length > maxQueryLength) return null;
  const sorted = sortedKinds(kinds);
  return { id: loopId(clean, sorted), query: clean, kinds: sorted, last: null, changes: null };
}

/** Adds the loop at the end; a loop that is already saved keeps its runs. */
export function saveLoop(loops: readonly Loop[], loop: Loop): readonly Loop[] {
  return loops.some((saved) => saved.id === loop.id) ? loops : [...loops, loop];
}

export function removeLoop(loops: readonly Loop[], id: string): readonly Loop[] {
  return loops.filter((loop) => loop.id !== id);
}

export function replaceLoop(loops: readonly Loop[], next: Loop): readonly Loop[] {
  return loops.map((loop) => (loop.id === next.id ? next : loop));
}

/** An engine failure is no answer; an abstention on a working engine is an empty result list. */
export function isFailedRun(response: SearchResponse | null): response is null {
  return response === null || response.abstain_reason === "engine_error";
}

export function entriesOf(response: SearchResponse, kinds: readonly Kind[]): LoopEntry[] {
  return response.results
    .filter(({ profile }) => kinds.length === 0 || kinds.includes(profile.kind))
    .map(({ profile }) => ({
      id: profile.id,
      name: profile.name.value,
      kind: profile.kind,
      href: profile.source_url,
    }));
}

/** New results in their new order, then dropped ones in their old order. */
export function diffEntries(before: readonly LoopEntry[], after: readonly LoopEntry[]): Change[] {
  const beforeIds = new Set(before.map((entry) => entry.id));
  const afterIds = new Set(after.map((entry) => entry.id));
  return [
    ...after
      .filter((entry) => !beforeIds.has(entry.id))
      .map((entry): Change => ({ type: "new", entry })),
    ...before
      .filter((entry) => !afterIds.has(entry.id))
      .map((entry): Change => ({ type: "dropped", entry })),
  ];
}

/** The first run sets the baseline, so it has nothing to compare against. */
export function recordRun(loop: Loop, response: SearchResponse): Loop {
  const entries = entriesOf(response, loop.kinds);
  const changes = loop.last === null ? null : diffEntries(loop.last.entries, entries);
  const last = { snapshot: response.versions.snapshot, mock: response.mode === "mock", entries };
  return { ...loop, last, changes };
}

export function noticeFor(loop: Loop, change: Change): AgentNotice {
  const { name, kind, href } = change.entry;
  const snapshot = loop.last?.snapshot ?? "";
  return change.type === "new"
    ? {
        title: `New in “${loop.query}”`,
        body: `${name} (${kindNames[kind]}) is a new result on snapshot ${snapshot}.`,
        href,
      }
    : {
        title: `Dropped from “${loop.query}”`,
        body: `${name} (${kindNames[kind]}) is no longer a result on snapshot ${snapshot}.`,
        href,
      };
}

/** True when the loop last ran on another snapshot than the one the engine serves now. */
export function needsRun(loop: Loop, snapshot: string | null): boolean {
  return snapshot !== null && loop.last !== null && loop.last.snapshot !== snapshot;
}
