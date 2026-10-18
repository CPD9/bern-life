"use client";

import { type FormEvent, useId, useState } from "react";
import type { NavigatorController } from "./use-navigator";

export function BriefInput({ controller }: { controller: NavigatorController }) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const busy = controller.state.status === "loading";

  function submit(event: FormEvent) {
    event.preventDefault();
    controller.submitBrief(file ? { kind: "pdf", file } : { kind: "text", text });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-muted text-sm">
        Upload a project brief as a PDF (up to 5 MB and 20 pages) or paste its text. The file is
        read once to take out the text and is not kept.
      </p>
      <label htmlFor={`${id}-file`} className="font-extrabold">
        Project brief PDF
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept="application/pdf"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="file:bg-chip-selected file:text-chip-selected-ink file:rounded-pill text-sm file:mr-3 file:border-0 file:px-4 file:py-2 file:font-bold"
      />
      <label htmlFor={`${id}-text`} className="font-extrabold">
        Or paste the text
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        className="bg-chip rounded-2xl px-4 py-3"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-primary text-primary-ink rounded-pill self-start px-5 py-3 font-bold disabled:opacity-60"
      >
        Find experts
      </button>
    </form>
  );
}
