"use client";

// One calm status, the explanation one tap away. The chip opens a native popover (no state to keep
// in sync), the line under an answer discloses its "Why?" inline, and only sample data earns a
// banner, because only then is nothing on screen a real page.
import { useId, useState } from "react";
import { type AnswerSource, sampleDataBanner } from "@/infrastructure/answer-source";

const chipTones = {
  quiet: "text-muted",
  warn: "bg-warn-bg text-warn-ink",
} as const;

/** The label alone; tapping it opens the sentence and the longer explanation. */
export function AnswerSourceChip({ source }: { source: AnswerSource }) {
  const id = useId();
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        className={`rounded-pill focus-visible:outline-focus px-2 py-0.5 text-xs font-bold focus-visible:outline-3 ${chipTones[source.tone]}`}
      >
        {source.label}
      </button>
      <div
        id={id}
        popover="auto"
        className="bg-panel shadow-panel border-panel-border text-ink fixed inset-0 m-auto h-fit w-fit max-w-xs rounded-2xl border p-4 text-sm"
      >
        <p className="font-extrabold">{source.label}</p>
        <p className="mt-1">{source.sentence}</p>
        <p className="text-muted mt-2">{source.explanation}</p>
      </div>
    </>
  );
}

/** Under an answer: the sentence, then "Why?" discloses the explanation, closed by default. */
export function AnswerSourceLine({ source }: { source: AnswerSource }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="text-muted flex flex-col gap-2 text-sm">
      <p>
        {source.sentence}{" "}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((was) => !was)}
          className="text-primary focus-visible:outline-focus rounded font-bold focus-visible:outline-3"
        >
          Why?
        </button>
      </p>
      <p id={id} hidden={!open} className="max-w-prose">
        {source.explanation}
      </p>
    </div>
  );
}

export function SampleDataBanner() {
  const cut = sampleDataBanner.indexOf(". ") + 1;
  return (
    <p className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3 text-sm">
      <strong>{sampleDataBanner.slice(0, cut)}</strong>
      {sampleDataBanner.slice(cut)}
    </p>
  );
}
