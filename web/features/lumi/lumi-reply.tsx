"use client";

// One reply from Bärnli: its words, with every name it mentions linked to that person's card below.
// Following a mention moves focus to the card, so it works the same by keyboard and by pointer.
import { Fragment, useId } from "react";
import type { SearchResult } from "@/infrastructure/claims";
import { ResultCard } from "@/infrastructure/ui/result-card";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import type { AgentAction, AgentReply } from "./agent-reply";
import { answerCards, splitMentions } from "./conversation";
import { heldActionLabels, reportNotKept } from "./reply-actions";

export function ResultCards({
  cards,
  cardId,
}: {
  cards: SearchResult[];
  cardId: (index: number) => string;
}) {
  return (
    <ol className="flex flex-col gap-4">
      {cards.map((result, index) => (
        <li
          key={result.profile.id}
          id={cardId(index)}
          tabIndex={-1}
          className="rounded-panel focus:outline-focus scroll-mt-4 focus:outline-3 focus:outline-offset-2"
        >
          <ResultCard result={result} />
        </li>
      ))}
    </ol>
  );
}

function HeldActions({
  held,
  onRun,
}: {
  held: readonly AgentAction[];
  onRun: (action: AgentAction) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm">
        This answer came while the panel was closed. Choose what to do:
      </p>
      <div className="flex flex-wrap gap-2">
        {held.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onRun(action)}
            className="bg-chip rounded-pill px-4 py-2 text-sm font-bold"
          >
            {heldActionLabels[action.type]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Actions that never run on their own, such as a match report, each one click away. A report the
 * browser would not keep says so under its button, which stays for another try.
 */
function OfferedActions({
  offered,
  notDone,
  onRun,
}: {
  offered: readonly AgentAction[];
  notDone: readonly AgentAction[];
  onRun: (action: AgentAction) => void;
}) {
  const reportNotDone = notDone.some((action) => action.type === "start_match_report");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {offered.map((action, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onRun(action)}
            className="bg-chip-selected text-chip-selected-ink rounded-pill px-4 py-2 text-sm font-bold"
          >
            {heldActionLabels[action.type]}
          </button>
        ))}
      </div>
      {reportNotDone && (
        <p role="alert" className="text-sm">
          {reportNotKept}
        </p>
      )}
    </div>
  );
}

type LumiReplyProps = {
  reply: AgentReply;
  name: string;
  held: readonly AgentAction[];
  offered: readonly AgentAction[];
  /** Offered actions clicked but not done. */
  notDone: readonly AgentAction[];
  onRunHeld: (action: AgentAction) => void;
};

export function LumiReply({ reply, name, held, offered, notDone, onRunHeld }: LumiReplyProps) {
  const baseId = useId();
  const reducedMotion = useReducedMotion();
  const cards = answerCards(reply.results);
  const cardId = (index: number) => `${baseId}-card-${index}`;
  const indexOf = new Map(cards.map((result, index) => [result.profile.id, index]));
  const segments = splitMentions(reply.reply, reply.mentions);

  function showCard(profileId: string) {
    const index = indexOf.get(profileId);
    const card = index === undefined ? null : document.getElementById(cardId(index));
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="bg-chip max-w-[92%] self-start rounded-2xl rounded-tl-sm px-4 py-3 break-words">
        <span className="sr-only">{name}: </span>
        {segments.map((segment, index) =>
          segment.kind === "text" ? (
            <Fragment key={index}>{segment.text}</Fragment>
          ) : (
            <button
              key={index}
              type="button"
              aria-label={`${segment.text}, see the card`}
              onClick={() => showCard(segment.profileId)}
              className="font-bold underline decoration-dotted underline-offset-4"
            >
              {segment.text}
            </button>
          ),
        )}
      </p>
      {held.length > 0 && <HeldActions held={held} onRun={onRunHeld} />}
      {offered.length > 0 && (
        <OfferedActions offered={offered} notDone={notDone} onRun={onRunHeld} />
      )}
      {cards.length > 0 && <ResultCards cards={cards} cardId={cardId} />}
    </div>
  );
}
