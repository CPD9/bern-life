import { formatBernTime } from "@/infrastructure/bern-time";
import type { Wallpaper as Scene } from "@/infrastructure/settings";
import { Wallpaper } from "./wallpaper";

type ScreensaverProps = {
  scene: Scene;
  now: Date | null;
  still: boolean;
};

// Covers the desk with the scene and the time. It takes no focus and says nothing to assistive
// technology: focus stays where it was, and the first pointer move, key or tap wakes the desk.
export function Screensaver({ scene, now, still }: ScreensaverProps) {
  return (
    <div
      data-screensaver
      aria-hidden="true"
      className={`from-sky-top to-sky-bottom absolute inset-0 isolate z-10 flex flex-col items-center justify-center bg-linear-to-b ${
        still ? "" : "animate-fade-in"
      }`}
    >
      <Wallpaper scene={scene} now={now} still={still} />
      <div className="bg-panel/80 rounded-panel shadow-panel flex flex-col items-center px-10 py-6 backdrop-blur">
        {now && (
          <p className="text-ink text-7xl font-extrabold tabular-nums">{formatBernTime(now)}</p>
        )}
        <p className="text-muted text-xl font-bold">Bern Life</p>
      </div>
    </div>
  );
}
