"use client";

import { type FormEvent, useId, useState } from "react";
import type { SearchLang } from "@/infrastructure/engine-types";
import { maxQueryLength } from "@/infrastructure/search-request";
import { exampleQuestions } from "./example-questions";
import type { NavigatorController } from "./use-navigator";

const langOptions: { value: SearchLang | "auto"; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "de", label: "DE" },
  { value: "en", label: "EN" },
  { value: "fr", label: "FR" },
];

export function AskInput({ controller }: { controller: NavigatorController }) {
  const id = useId();
  const [lang, setLang] = useState<SearchLang | "auto">("auto");
  const busy = controller.state.status === "loading";

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = controller.draft.trim();
    if (query === "") return;
    controller.search(lang === "auto" ? { query } : { query, lang });
  }

  // An example fills the box and searches at once, so one tap shows a full answer.
  function tryExample(query: string) {
    controller.setDraft(query);
    controller.search({ query });
  }

  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={`${id}-query`} className="font-extrabold">
        Ask in your words
      </label>
      <div className="flex gap-2">
        <input
          id={`${id}-query`}
          type="search"
          value={controller.draft}
          onChange={(event) => controller.setDraft(event.target.value)}
          maxLength={maxQueryLength}
          placeholder="glucose sensors, Blutzucker messen, capteurs de glucose"
          className="bg-chip rounded-pill placeholder:text-muted min-w-0 flex-1 px-5 py-3"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-ink rounded-pill px-5 py-3 font-bold disabled:opacity-60"
        >
          Search
        </button>
      </div>
      <fieldset className="flex flex-wrap items-center gap-1.5">
        <legend className="text-muted float-left mr-2 text-sm">Language</legend>
        {langOptions.map((option) => (
          <label
            key={option.value}
            className="rounded-pill bg-chip has-checked:bg-chip-selected has-checked:text-chip-selected-ink has-focus-visible:outline-focus cursor-pointer px-3 py-1 text-sm font-bold has-focus-visible:outline-3"
          >
            <input
              type="radio"
              name={`${id}-lang`}
              value={option.value}
              checked={lang === option.value}
              onChange={() => setLang(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {controller.state.status === "idle" && (
        <div className="flex flex-col gap-2">
          <p className="text-muted text-sm">Or tap one of these to see how an answer looks:</p>
          <ul aria-label="Example questions" className="flex flex-col gap-2">
            {exampleQuestions.map((example) => (
              <li key={example.lang}>
                <button
                  type="button"
                  onClick={() => tryExample(example.query)}
                  className="bg-chip rounded-2xl focus-visible:outline-focus flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm focus-visible:outline-3"
                >
                  <span className="text-muted shrink-0 text-xs font-bold tracking-wide uppercase">
                    {example.lang}
                  </span>
                  <span>{example.query}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
