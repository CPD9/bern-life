import { type ReactNode, useId } from "react";

// The drawing frame and the two simpler scenes. Everything is drawn in 1200 × 600 user units and
// sliced to the surface from the bottom, so the skyline and the water stay in view at any size.
// Colours are the scene tokens in globals.css, so night mode darkens them with everything else.

export function Frame({ children }: { children: ReactNode }) {
  return (
    <svg className="h-full w-full" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
      {children}
    </svg>
  );
}

// The old town's gabled houses along the Aare, with the Zytglogge in the middle.
export const roofline =
  "M0 520 V420 H30 V392 L60 362 L90 392 V420 H130 V386 L165 350 L200 386 V420 H250 V396 " +
  "L280 368 L310 396 V420 H355 V388 L390 356 L425 388 V420 H470 V398 L500 372 L530 398 V420 " +
  "H565 V250 H555 L600 150 L645 250 H635 V420 H680 V392 L715 358 L750 392 V420 H795 V398 " +
  "L825 370 L855 398 V420 H905 V386 L940 350 L975 386 V420 H1020 V396 L1050 368 L1080 396 " +
  "V420 H1125 V390 L1160 356 L1195 390 V420 H1200 V520 Z";

function wave(top: number, amplitude: number, length: number): string {
  const half = length / 2;
  const quarter = length / 4;
  let path = `M-120 ${top}`;
  for (let x = -120; x < 1320; x += length) {
    path += ` q${quarter} ${-amplitude} ${half} 0 t${half} 0`;
  }
  return `${path} V600 H-120 Z`;
}

const waves = [
  { path: wave(380, 14, 300), seconds: 11 },
  { path: wave(450, 18, 240), seconds: 8 },
  { path: wave(520, 22, 200), seconds: 6 },
];

export function AareScene({ still }: { still: boolean }) {
  return (
    <Frame>
      {waves.map(({ path, seconds }, layer) => (
        <path
          key={layer}
          d={path}
          fill="var(--scene-water)"
          className={still ? undefined : "animate-wave-sway"}
          style={{ animationDuration: `${seconds}s` }}
        />
      ))}
      <g
        transform="translate(700 452)"
        className={still ? undefined : "animate-wave-sway"}
        style={{ animationDuration: "13s" }}
      >
        <path d="M-44 0 Q0 16 44 0 Q0 -4 -44 0 Z" fill="var(--scene-near)" />
        <circle cx="0" cy="-10" r="7" fill="var(--scene-near)" />
        <path
          d="M-30 -22 L30 -4"
          stroke="var(--scene-near)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </Frame>
  );
}

const stars = Array.from({ length: 36 }, (_, index) => ({
  x: (index * 331) % 1200,
  y: 20 + ((index * 197) % 300),
  radius: 1 + (index % 3) * 0.5,
  delay: (index % 7) * 0.35,
}));

export function NightScene({ still }: { still: boolean }) {
  const crescent = useId();
  return (
    <Frame>
      <rect width="1200" height="600" fill="var(--scene-dusk)" />
      <mask id={crescent}>
        <rect width="1200" height="600" fill="white" />
        <circle cx="968" cy="96" r="34" fill="black" />
      </mask>
      <circle cx="950" cy="110" r="38" fill="var(--scene-star)" mask={`url(#${crescent})`} />
      {stars.map(({ x, y, radius, delay }) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={radius}
          fill="var(--scene-star)"
          className={still ? undefined : "animate-star-twinkle"}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      <path d={roofline} fill="var(--scene-near)" />
      <path
        d="M0 600 V500 C300 480 600 520 900 500 C1000 494 1100 496 1200 500 V600 Z"
        fill="var(--scene-water)"
      />
    </Frame>
  );
}
