"use client";

import { useEffect, useRef, useState } from "react";
import { formatBernDate, formatBernTime } from "@/infrastructure/bern-time";
import { Badge } from "@/infrastructure/ui/badge";
import { useEscapeLayer } from "@/infrastructure/ui/escape-layers";
import { type PhoneFolder, FolderPanel, FolderTile } from "./phone-folder";
import type { PhoneApp } from "./phone-types";

type PhoneHomeProps = {
  now: Date | null;
  apps: readonly PhoneApp[];
  onOpen: (id: string) => void;
};

function tileName(app: PhoneApp): string {
  return app.badge !== undefined && app.badge > 0 ? `${app.label}, ${app.badge} new` : app.label;
}

function AppTile({ app, onOpen }: { app: PhoneApp; onOpen: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        data-app-tile={app.id}
        aria-label={tileName(app)}
        onClick={() => onOpen(app.id)}
        className="focus-visible:outline-focus flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center text-xs font-bold focus-visible:outline-3"
      >
        <span
          aria-hidden="true"
          style={{ backgroundColor: app.tile }}
          className="shadow-panel relative flex size-15 items-center justify-center rounded-2xl text-white"
        >
          {app.icon}
          <span className="absolute -top-1.5 -right-1.5">
            <Badge count={app.badge} label="new" />
          </span>
        </span>
        <span aria-hidden="true">{app.label}</span>
      </button>
    </li>
  );
}

export type HomeTile =
  | { readonly kind: "app"; readonly app: PhoneApp }
  | { readonly kind: "folder"; readonly folder: PhoneFolder };

/** The grid's tiles in order: an app, or a folder where its first app sits holding all of them. */
export function homeTiles(apps: readonly PhoneApp[]): HomeTile[] {
  const tiles: HomeTile[] = [];
  const folders = new Map<string, PhoneApp[]>();
  for (const app of apps) {
    if (app.folder === undefined) {
      tiles.push({ kind: "app", app });
      continue;
    }
    const members = folders.get(app.folder);
    if (members) {
      members.push(app);
      continue;
    }
    const folderApps = [app];
    folders.set(app.folder, folderApps);
    tiles.push({
      kind: "folder",
      folder: { name: app.folder, hint: app.folderHint, apps: folderApps },
    });
  }
  return tiles;
}

/** Apps marked for the dock go there; when none is marked, the first four do. */
export function splitDock(apps: readonly PhoneApp[]): { grid: PhoneApp[]; dock: PhoneApp[] } {
  const marked = apps.some((app) => app.dock === true);
  const inDock = (app: PhoneApp, index: number) => (marked ? app.dock === true : index < 4);
  return {
    grid: apps.filter((app, index) => !inDock(app, index)),
    dock: apps.filter(inDock),
  };
}

// The home screen: clock, a four-column grid of apps and folders, a dock. One folder can be open
// at a time; while it is, the rest of the home is inert behind it, Escape or a tap outside closes
// it, and focus goes back to the folder's tile.
export function PhoneHome({ now, apps, onOpen }: PhoneHomeProps) {
  const home = useRef<HTMLDivElement>(null);
  const [openFolderName, setOpenFolderName] = useState<string | null>(null);
  const closedFolderName = useRef<string | null>(null);
  const { grid, dock } = splitDock(apps);
  const tiles = homeTiles(grid);
  const openFolder = tiles.find(
    (tile): tile is Extract<HomeTile, { kind: "folder" }> =>
      tile.kind === "folder" && tile.folder.name === openFolderName,
  )?.folder;

  function closeFolder() {
    closedFolderName.current = openFolderName;
    setOpenFolderName(null);
  }

  useEscapeLayer(openFolder !== undefined, closeFolder);

  // The tile is inert while its folder is open, so focus returns to it once the folder has gone.
  useEffect(() => {
    const name = closedFolderName.current;
    if (openFolderName !== null || name === null) return;
    closedFolderName.current = null;
    home.current?.querySelector<HTMLElement>(`[data-folder-tile="${CSS.escape(name)}"]`)?.focus();
  }, [openFolderName]);

  return (
    <div
      ref={home}
      className="from-sky-top to-panel relative flex min-h-0 flex-1 flex-col bg-linear-to-b"
    >
      <div inert={openFolder !== undefined} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 pt-8 pb-6">
          <header className="flex flex-col gap-1 px-2">
            {now && (
              <>
                <p className="text-6xl font-extrabold tracking-tight">{formatBernTime(now)}</p>
                <p className="text-muted text-lg font-bold">{formatBernDate(now)} · Bern</p>
              </>
            )}
          </header>
          {tiles.length > 0 && (
            <ul aria-label="Apps" className="grid grid-cols-4 gap-x-2 gap-y-5">
              {tiles.map((tile) =>
                tile.kind === "app" ? (
                  <AppTile key={tile.app.id} app={tile.app} onOpen={onOpen} />
                ) : (
                  <FolderTile
                    key={tile.folder.name}
                    folder={tile.folder}
                    open={tile.folder.name === openFolderName}
                    onOpen={setOpenFolderName}
                  />
                ),
              )}
            </ul>
          )}
        </div>
        {dock.length > 0 && (
          <nav aria-label="Dock" className="px-3 pb-4">
            <ul className="bg-panel/70 border-panel-border grid grid-cols-4 gap-2 rounded-3xl border p-2 backdrop-blur">
              {dock.map((app) => (
                <AppTile key={app.id} app={app} onOpen={onOpen} />
              ))}
            </ul>
          </nav>
        )}
      </div>
      {openFolder && (
        <FolderPanel folder={openFolder} onClose={closeFolder}>
          {openFolder.apps.map((app) => (
            <AppTile key={app.id} app={app} onOpen={onOpen} />
          ))}
        </FolderPanel>
      )}
    </div>
  );
}
