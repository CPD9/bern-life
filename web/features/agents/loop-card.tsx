"use client";

// One saved loop. What a run just did is announced in a polite live region, so a screen reader
// hears the outcome without moving focus; Run now stays focusable while it runs (aria-disabled,
// not disabled), so keyboard focus is not dropped mid-run. Each run's summary is a new node (keyed
// by a run count), so a run that reads the same as the one before is still announced.

import { useState } from "react";
import { kindsText } from "./kinds";
import { type Change, type Loop, needsRun, runSummary } from "./loops";
import type { RunStatus } from "./use-loops";

type LoopCardProps = {
  loop: Loop;
  status: RunStatus | undefined;
  snapshot: string | null;
  onRun: () => void;
  onRemove: () => void;
};

function lastRunText(loop: Loop): string {
  if (loop.last === null) return "Not run yet.";
  const count = loop.last.entries.length;
  const results = count === 1 ? "1 result" : `${count} results`;
  return `Last ran on snapshot ${loop.last.snapshot}: ${results}.`;
}

function ChangeList({ changes }: { changes: readonly Change[] | null }) {
  if (changes === null) return null;
  if (changes.length === 0) {
    return <p className="text-muted text-sm">No new or dropped results since the run before.</p>;
  }
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label="Changes since the run before">
      {changes.map(({ type, entry }) => (
        <li key={`${type}-${entry.id}`}>
          <span className="font-bold">{type === "new" ? "New" : "Dropped"}:</span>{" "}
          <a href={entry.href} target="_blank" rel="noopener noreferrer" className="underline">
            {entry.name}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function LoopCard({ loop, status, snapshot, onRun, onRemove }: LoopCardProps) {
  const running = status === "running";
  const runLabel = running ? "Running…" : "Run now";
  // A new `last` means a run just finished; the run it replaced says what to compare against.
  const [seenRun, setSeenRun] = useState(loop.last);
  const [summary, setSummary] = useState({ text: "", run: 0 });
  if (loop.last !== seenRun) {
    setSeenRun(loop.last);
    setSummary({ text: runSummary(seenRun, loop), run: summary.run + 1 });
  }
  return (
    <li className="border-panel-border flex flex-col gap-2 rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h4 className="font-extrabold break-words">{loop.query}</h4>
          <p className="text-muted text-sm">{kindsText(loop.kinds)}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={running ? undefined : onRun}
            aria-disabled={running}
            aria-label={`${runLabel}: ${loop.query}`}
            className="bg-primary text-primary-ink rounded-pill px-4 py-1.5 text-sm font-bold aria-disabled:opacity-60"
          >
            {runLabel}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove loop: ${loop.query}`}
            className="bg-chip rounded-pill px-4 py-1.5 text-sm font-bold"
          >
            Remove
          </button>
        </div>
      </div>
      <p className="text-sm">
        {lastRunText(loop)}
        {loop.last?.mock === true && <span className="ml-2 font-bold">MOCK</span>}
      </p>
      <p role="status" aria-live="polite" className="text-sm empty:sr-only">
        {summary.text !== "" && <span key={summary.run}>{summary.text}</span>}
      </p>
      {needsRun(loop, snapshot) && (
        <p className="bg-warn-bg text-warn-ink rounded-xl px-3 py-1.5 text-sm font-bold">
          New snapshot: run again
        </p>
      )}
      {status === "failed" && (
        <p role="alert" className="bg-warn-bg text-warn-ink rounded-xl px-3 py-1.5 text-sm">
          The search did not answer. Try again.
        </p>
      )}
      <ChangeList changes={loop.changes} />
    </li>
  );
}
