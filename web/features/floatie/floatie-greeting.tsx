"use client";

// Lumi beside a speech bubble. Tapping Lumi moves on to its next line. The figure is passed in so
// this stays free of three.js and can be tested with Bun; app/ gives it the real floatie.

import { type ReactNode, useState } from "react";
import { greetingLines, nextLine } from "./lumi-lines";

export function FloatieGreeting({ figure }: { figure: (onSelect: () => void) => ReactNode }) {
  const [line, setLine] = useState(0);
  return (
    <div className="flex items-center gap-3">
      {figure(() => setLine(nextLine))}
      <p
        aria-live="polite"
        className="bg-chip relative rounded-[1.25rem] px-4 py-3 text-sm leading-snug font-semibold before:absolute before:top-1/2 before:-left-1.5 before:size-3 before:-translate-y-1/2 before:rotate-45 before:bg-inherit"
      >
        {greetingLines[line]}
      </p>
    </div>
  );
}
