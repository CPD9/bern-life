import { formatBernDate, formatBernTime } from "@/infrastructure/bern-time";
import { Badge } from "@/infrastructure/ui/badge";
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
          className="shadow-panel relative flex size-14 items-center justify-center rounded-2xl text-white"
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

type TileGroup = { readonly label: string; readonly apps: PhoneApp[] };

/** Grouped apps, in the order their groups first appear; apps without a group are left out. */
export function tileGroups(apps: readonly PhoneApp[]): TileGroup[] {
  const groups: TileGroup[] = [];
  for (const app of apps) {
    if (app.group === undefined) continue;
    const group = groups.find((candidate) => candidate.label === app.group);
    if (group) group.apps.push(app);
    else groups.push({ label: app.group, apps: [app] });
  }
  return groups;
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

export function PhoneHome({ now, apps, onOpen }: PhoneHomeProps) {
  const { grid, dock } = splitDock(apps);
  const groups = tileGroups(grid);
  const ungrouped = grid.filter((app) => app.group === undefined);
  return (
    <div className="from-sky-top to-panel flex min-h-0 flex-1 flex-col bg-linear-to-b">
      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pt-8 pb-6">
        <header className="flex flex-col gap-1">
          {now && (
            <>
              <p className="text-6xl font-extrabold tracking-tight">{formatBernTime(now)}</p>
              <p className="text-muted text-lg font-bold">{formatBernDate(now)} · Bern</p>
            </>
          )}
        </header>
        {groups.map((group) => (
          <section key={group.label} aria-label={group.label} className="flex flex-col gap-3">
            <h2 className="text-muted text-sm font-bold">{group.label}</h2>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-5">
              {group.apps.map((app) => (
                <AppTile key={app.id} app={app} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        ))}
        {ungrouped.length > 0 && (
          <ul aria-label="Apps" className="grid grid-cols-4 gap-x-2 gap-y-5">
            {ungrouped.map((app) => (
              <AppTile key={app.id} app={app} onOpen={onOpen} />
            ))}
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
  );
}
