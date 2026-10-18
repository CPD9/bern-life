import { formatBernDate, formatBernTime } from "@/infrastructure/bern-time";
import type { PhoneApp } from "./phone";

type PhoneHomeProps = {
  now: Date | null;
  apps: readonly PhoneApp[];
  onOpen: (id: string) => void;
};

export function PhoneHome({ now, apps, onOpen }: PhoneHomeProps) {
  return (
    <div className="from-sky-top to-panel flex flex-1 flex-col gap-8 overflow-y-auto bg-linear-to-b px-6 pt-16 pb-8">
      <header className="flex flex-col gap-1">
        {now && (
          <>
            <p className="text-6xl font-extrabold tracking-tight">{formatBernTime(now)}</p>
            <p className="text-muted text-lg font-bold">{formatBernDate(now)} · Bern</p>
          </>
        )}
      </header>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-5">
        {apps.map((app) => (
          <li key={app.id}>
            <button
              type="button"
              onClick={() => onOpen(app.id)}
              className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center text-xs font-bold"
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: app.tile }}
                className="shadow-panel flex size-14 items-center justify-center rounded-2xl text-white"
              >
                {app.icon}
              </span>
              {app.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
