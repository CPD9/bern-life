"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { IconButton } from "@/infrastructure/ui/button";
import { keepTabInside } from "@/infrastructure/ui/focus-trap";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import type { PhoneApp } from "./phone-types";

// A folder the iOS way: on the home grid, a squircle showing its first nine apps' icons in
// miniature; opened, a frosted panel over the dimmed home with the apps in three columns. The
// panel owns focus while it is up (Tab stays inside, the home behind is inert); the home decides
// when it opens and closes, and where focus goes afterwards.
export type PhoneFolder = {
  readonly name: string;
  readonly hint?: string | undefined;
  readonly apps: readonly PhoneApp[];
};

const miniIconsShown = 9;

function MiniIcon({ app }: { app: PhoneApp }) {
  return (
    <span
      data-mini-icon={app.id}
      style={{ backgroundColor: app.tile }}
      className="flex size-3.5 items-center justify-center rounded-[4px] text-white"
    >
      <span className="flex size-7 shrink-0 scale-50 items-center justify-center">{app.icon}</span>
    </span>
  );
}

type FolderTileProps = {
  folder: PhoneFolder;
  open: boolean;
  onOpen: (name: string) => void;
};

export function FolderTile({ folder, open, onOpen }: FolderTileProps) {
  return (
    <li>
      <button
        type="button"
        data-folder-tile={folder.name}
        aria-label={`${folder.name} folder`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpen(folder.name)}
        className="focus-visible:outline-focus flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center text-xs font-bold focus-visible:outline-3"
      >
        <span
          aria-hidden="true"
          className="bg-panel/60 shadow-panel grid size-15 grid-cols-3 gap-[3px] rounded-2xl p-1.5 backdrop-blur"
        >
          {folder.apps.slice(0, miniIconsShown).map((app) => (
            <MiniIcon key={app.id} app={app} />
          ))}
        </span>
        <span aria-hidden="true">{folder.name}</span>
      </button>
    </li>
  );
}

type FolderPanelProps = {
  folder: PhoneFolder;
  onClose: () => void;
  /** The folder's app tiles, each carrying data-app-tile; the first one takes focus on open. */
  children: ReactNode;
};

export function FolderPanel({ folder, onClose, children }: FolderPanelProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    element.querySelector<HTMLElement>("[data-app-tile]")?.focus();
    const onKeyDown = (event: KeyboardEvent) => keepTabInside(event, element);
    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, []);

  const transition = reducedMotion ? "" : "motion-safe:animate-[phone-in_200ms_ease-out]";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <button
        type="button"
        data-folder-backdrop
        tabIndex={-1}
        aria-label="Close folder"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-panel/80 shadow-panel relative flex w-full max-w-80 flex-col gap-4 rounded-[1.75rem] p-4 backdrop-blur-xl ${transition}`}
      >
        <header className="flex items-start">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-1 pl-9 text-center">
            <h2 id={titleId} className="text-lg font-extrabold">
              {folder.name}
            </h2>
            {folder.hint && <p className="text-muted text-sm font-bold">{folder.hint}</p>}
          </div>
          <IconButton label="Close" icon="✕" onClick={onClose} />
        </header>
        <ul className="grid grid-cols-3 gap-x-2 gap-y-5">{children}</ul>
      </div>
    </div>
  );
}
