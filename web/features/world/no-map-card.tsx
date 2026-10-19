import { Button } from "@/infrastructure/ui/button";

type NoMapCardProps = {
  onOpenAsk: () => void;
  onOpenDesk: () => void;
  /** Given when trying again may help: the scene threw or its context was lost. */
  onRetry: (() => void) | null;
};

// Where the map would be when the browser cannot draw it: everything else in Bern Life is plain
// HTML, so the card says so and opens the two ways in that need no 3D.
export function NoMapCard({ onOpenAsk, onOpenDesk, onRetry }: NoMapCardProps) {
  return (
    <div className="flex size-full items-center justify-center px-4">
      <section
        aria-label="Map of Bern"
        data-no-map
        className="rounded-panel bg-panel border-panel-border shadow-panel flex max-w-sm flex-col gap-4 border p-5"
      >
        <p>
          The map needs 3D graphics, which this browser does not offer. Ask, the office desk and
          every app still work.
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
