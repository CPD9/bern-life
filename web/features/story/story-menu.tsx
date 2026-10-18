"use client";

import { useEffect, useRef, useState } from "react";
import { criterionTags } from "./criteria";
import type { QuestStatus } from "./engine";
import { ProgressDots } from "./progress-dots";
import type { StoryController } from "./use-story";

const statusLabels: Record<QuestStatus, string> = {
  done: "Done",
  current: "Now",
  ready: "Open",
  coming: "Coming next",
};

type StoryMenuProps = { controller: StoryController; open: boolean; onClose: () => void };

export function StoryMenu({ controller, open, onClose }: StoryMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="story-menu-title"
      onClose={() => {
        setConfirmRestart(false);
        onClose();
      }}
      className="bg-panel text-ink m-auto w-[min(36rem,calc(100vw-2rem))] rounded-3xl p-0 backdrop:bg-black/40"
    >
      <div className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="story-menu-title" className="text-xl font-extrabold">
              {controller.story.title}
            </h2>
            <p className="text-muted text-sm">
              Each quest shows one part of the case. Steps finish only when you do them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="bg-chip rounded-pill px-4 py-1.5 text-sm font-bold"
          >
            Close
          </button>
        </div>
        <ol className="flex flex-col gap-2">
          {controller.progress.quests.map(({ quest, status, stepsDone }) => (
            <li
              key={quest.id}
              className={`border-panel-border flex flex-col gap-1.5 rounded-2xl border p-3 ${
                status === "current" ? "border-primary border-2" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-extrabold">{quest.title}</h3>
                <span className="text-muted text-xs font-bold">{statusLabels[status]}</span>
              </div>
              <p className="text-muted text-sm">{quest.goal}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-chip rounded-pill px-2.5 py-0.5 text-xs font-bold">
                  {criterionTags[quest.criterion]}
                </span>
                <ProgressDots total={quest.steps.length} done={stepsDone} />
                {status === "ready" && (
                  <button
                    type="button"
                    onClick={() => {
                      controller.focus(quest.id);
                      dialog.current?.close();
                    }}
                    className="text-primary ml-auto text-sm font-bold"
                  >
                    Go to this quest
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2 text-sm">
          {confirmRestart ? (
            <>
              <span>Start again from the first quest?</span>
              <button
                type="button"
                onClick={() => {
                  controller.restart();
                  setConfirmRestart(false);
                }}
                className="bg-chip-selected text-chip-selected-ink rounded-pill px-3 py-1 font-bold"
              >
                Yes, start again
              </button>
              <button type="button" onClick={() => setConfirmRestart(false)} className="font-bold">
                Keep my progress
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRestart(true)}
              className="text-muted font-bold"
            >
              Start the story again
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
