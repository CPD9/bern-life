import { formatBernTime } from "@/infrastructure/bern-time";
import type { Wallpaper as Scene } from "@/infrastructure/settings";
import { AareScene, Frame, NightScene, roofline } from "./wallpaper-scenes";

// The picture behind the desktop's windows, and the screensaver's. Motion is CSS classes alone,
// so `still` (lite graphics or reduced motion) is one switch that leaves nothing moving.

type WallpaperProps = {
  scene: Scene;
  /** Bern time for the Zytglogge; null before the clock has ticked, and the face shows no hands. */
  now: Date | null;
  still: boolean;
};

export function Wallpaper({ scene, now, still }: WallpaperProps) {
  return (
    <div
      aria-hidden="true"
      data-wallpaper={scene}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {scene === "bern" && <BernScene now={now} still={still} />}
      {scene === "aare" && <AareScene still={still} />}
      {scene === "night" && <NightScene still={still} />}
    </div>
  );
}

const clockCentre = { x: 600, y: 320 };

export function clockAngles(now: Date): { hour: number; minute: number } {
  const [hours = 0, minutes = 0] = formatBernTime(now).split(":").map(Number);
  return { hour: (hours % 12) * 30 + minutes * 0.5, minute: minutes * 6 };
}

function Hand({ angle, length, name }: { angle: number; length: number; name: string }) {
  const { x, y } = clockCentre;
  return (
    <line
      data-hand={name}
      x1={x}
      y1={y}
      x2={x}
      y2={y - length}
      stroke="var(--scene-hand)"
      strokeWidth="4"
      strokeLinecap="round"
      transform={`rotate(${angle} ${x} ${y})`}
    />
  );
}

const cloud = "M-70 15 Q-70 -15 -40 -15 Q-30 -40 0 -35 Q35 -40 45 -10 Q75 -10 75 15 Z";

const clouds = [
  { x: 150, y: 120, size: 1.2 },
  { x: 480, y: 70, size: 0.9 },
  { x: 820, y: 140, size: 1.4 },
  { x: 1080, y: 90, size: 1 },
];

function BernScene({ now, still }: { now: Date | null; still: boolean }) {
  const angles = now && clockAngles(now);
  return (
    <Frame>
      {/* Two copies a frame apart, so the drift of one frame loops without a seam. */}
      <g className={still ? undefined : "animate-cloud-drift"} fill="var(--scene-cloud)">
        {[0, 1200].map((offset) =>
          clouds.map(({ x, y, size }) => (
            <path
              key={`${offset + x}`}
              d={cloud}
              transform={`translate(${offset + x} ${y}) scale(${size})`}
            />
          )),
        )}
      </g>
      <path
        d="M0 420 V440 C200 370 400 430 600 390 C800 350 1000 410 1200 370 V420 Z"
        fill="var(--scene-far)"
      />
      <path d={roofline} fill="var(--scene-near)" />
      <circle cx={clockCentre.x} cy={clockCentre.y} r="30" fill="var(--scene-face)" />
      {angles && <Hand name="hour" angle={angles.hour} length={16} />}
      {angles && <Hand name="minute" angle={angles.minute} length={24} />}
      <path
        d="M0 600 V505 C300 485 600 525 900 505 C1000 499 1100 501 1200 505 V600 Z"
        fill="var(--scene-water)"
      />
    </Frame>
  );
}
