"use client";

// The You sheet: what Bern Life knows about the player, in one place. A native modal dialog, so
// the world behind it is inert and Escape closes it; it opens on mount, puts focus on the selected
// tab and gives focus back to whatever opened it.
import { useEffect, useId, useRef, useState } from "react";
import type { StoryProgress } from "@/features/story/engine";
import { AgentsPanel, GoalsPanel, PeoplePanel, ProfilePanel, SkillsPanel } from "./you-panels";
import type { Agent, PersonLook, YouProfile } from "./you-summary";
import { type YouTab, YouTabs } from "./you-tabs";

type YouTabId = "profile" | "goals" | "skills" | "people" | "agents";

type YouSheetProps = {
  profile: YouProfile;
  person?: PersonLook | undefined;
  agent: Agent;
  story: StoryProgress;
  onClose: () => void;
};

export function YouSheet({ profile, person, agent, story, onClose }: YouSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<YouTabId>("profile");
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  }, []);

  function handleClose() {
    onClose();
    opener.current?.focus();
  }

  const tabs: YouTab<YouTabId>[] = [
    { id: "profile", label: "Profile", panel: <ProfilePanel profile={profile} person={person} /> },
    { id: "goals", label: "Goals", panel: <GoalsPanel profile={profile} story={story} /> },
    { id: "skills", label: "Skills", panel: <SkillsPanel profile={profile} /> },
    { id: "people", label: "People", panel: <PeoplePanel /> },
    { id: "agents", label: "Agents", panel: <AgentsPanel agent={agent} /> },
  ];

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={handleClose}
      className="bg-panel text-ink m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl p-0 backdrop:bg-black/40"
    >
      <div className="flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold">
              You
            </h2>
            <p className="text-muted text-sm">What you told Bern Life, and who works with you.</p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="bg-chip rounded-pill px-4 py-1.5 text-sm font-bold"
          >
            Close
          </button>
        </div>
        <YouTabs tabs={tabs} selected={selected} onSelect={setSelected} label="About you" />
      </div>
    </dialog>
  );
}
