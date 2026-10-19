import { useId, useRef } from "react";
import { Button } from "@/infrastructure/ui/button";
import { useTakeLostFocus } from "@/infrastructure/ui/scene-guard";

type NoMapCardProps = {
  onOpenAsk: () => void;
  onOpenDesk: () => void;
  /** Given when trying again may help: the scene threw or its context was lost. */
  onRetry: (() => void) | null;
  /** True while the office covers the map: its card then leaves focus where it is, and its
   * buttons leave the tab order with it. */
  covered?: boolean;
};

// Where the map would be when it cannot be drawn: everything else in Bern Life is plain HTML, so
// the card says so and opens the two ways in that need no 3D. A map that stops drawing takes the
// focus it held with it, so the card takes that focus instead.
export function NoMapCard({ onOpenAsk, onOpenDesk, onRetry, covered = false }: NoMapCardProps) {
  const card = useRef<HTMLElement>(null);
  const textId = useId();
  useTakeLostFocus(card, onRetry !== null && !covered);
  return (
    <div inert={covered} className="flex size-full items-center justify-center px-4">
      <section
        ref={card}
        tabIndex={-1}
        aria-label="Map of Bern"
        aria-describedby={textId}
        data-no-map
        className="rounded-panel bg-panel border-panel-border shadow-panel flex max-w-sm flex-col gap-4 border p-5"
      >
        <p id={textId}>
          {onRetry === null
            ? "The map needs 3D graphics, which this browser does not offer."
            : "The map stopped drawing."}{" "}
          Ask, the office desk and every app still work.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onOpenAsk}>
            Open Ask
          </Button>
          <Button onClick={onOpenDesk}>Open the office desk</Button>
          {onRetry !== null && (
            <Button variant="ghost" onClick={onRetry}>
              Try the map again
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
