import { suggestions } from "./suggestions";

/** What the panel shows before the first message: what Lumi does, and the recorded questions. */
export function LumiIntro({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p>
        Ask about research and expertise in Bern. Every person I name comes with a card that shows
        the sentence and the page it is from.
      </p>
      <p className="text-muted text-sm">Try one of these:</p>
      <ul className="flex flex-col items-start gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.text}>
            <button
              type="button"
              onClick={() => onSend(suggestion.text)}
              className="bg-chip rounded-2xl px-4 py-2 text-left text-sm font-bold"
            >
              {suggestion.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
