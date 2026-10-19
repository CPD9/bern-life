import type { Claim, Evidence } from "@/infrastructure/contract-types.generated";
import { fragmentUrl } from "@/infrastructure/text-fragment";

const fetchedFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/Zurich",
});

const methodText: Record<Claim["method"], string> = {
  selector: "Read from the page by a site rule.",
  model: "Proposed by Apertus and kept because the sentence was found on the page.",
};

type ClaimButtonProps = {
  claim: Claim;
  open: boolean;
  cited: boolean;
  panelId: string;
  onToggle: () => void;
};

export function ClaimButton({ claim, open, cited, panelId, onToggle }: ClaimButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className={`rounded-pill px-3 py-1 text-left text-sm transition-colors ${
        open ? "bg-chip-selected text-chip-selected-ink" : "bg-chip hover:bg-mark"
      } ${cited ? "font-bold" : ""}`}
    >
      {claim.value}
      {cited && <span className="sr-only"> (cited)</span>}
    </button>
  );
}

/** The app's own page on having a quote corrected or removed (app/corrections), so the notes
 * that link to it work wherever the app runs. */
export const CORRECTIONS_PATH = "/corrections";

/** What a quote is, as the note names it, and how a correction on its page reaches Bern Life. */
const quotes = {
  sentence: {
    noun: "sentence",
    corrected: "A correction made on that page reaches Bern Life with the next snapshot",
    ask: "to ask for its removal from Bern Life",
  },
  address: {
    noun: "address",
    corrected:
      "Addresses are kept in Bern Life's repository and corrected there by a change to places.json, not by the next snapshot",
    ask: "to ask for a correction or its removal",
  },
  saved: {
    noun: "sentence",
    corrected: "Your saved copy stays as it is in this browser until you remove it",
    ask: "to ask for its removal from Bern Life",
  },
} as const;

type CorrectionNoteProps = {
  fetchedAt?: string | null | undefined;
  /** What is quoted: a sentence from the snapshot (the default), a map address, or a sentence the
   * player saved to the Library. */
  quoted?: keyof typeof quotes;
};

/**
 * How a quote gets corrected or removed, folded away under one quiet line. It only explains:
 * nothing here sends anything, and its one link opens the app's Corrections and removal page.
 */
export function CorrectionNote({ fetchedAt, quoted = "sentence" }: CorrectionNoteProps) {
  const when = fetchedAt
    ? `as it read on ${fetchedFormat.format(new Date(fetchedAt))}`
    : "as Bern Life stored it";
  const quote = quotes[quoted];
  return (
    <details className="text-muted">
      <summary className="w-fit cursor-pointer">Wrong or outdated?</summary>
      <p className="mt-1">
        This {quote.noun} is quoted from the institution&apos;s page {when}. {quote.corrected};{" "}
        {quote.ask}, see{" "}
        <a
          href={CORRECTIONS_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline"
        >
          Corrections and removal
        </a>
        .
      </p>
    </details>
  );
}

function pageLabel(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
}

export function EvidencePanel({ claim, id }: { claim: Claim; id: string }) {
  return <SpanEvidence evidence={claim.evidence} note={methodText[claim.method]} id={id} />;
}

type SpanEvidenceProps = { evidence: Evidence; note: string; id?: string };

/** A verbatim span with its page, fetch date and a link to the sentence: a claim's evidence, or
 * the sentence that ties a result to a related project. */
export function SpanEvidence({ evidence, note, id }: SpanEvidenceProps) {
  return (
    <div id={id} className="bg-chip mt-2 flex flex-col gap-2 rounded-2xl p-4 text-sm">
      <blockquote className="text-ink">
        <mark className="bg-mark text-ink rounded px-0.5">“{evidence.span}”</mark>
      </blockquote>
      <p className="text-muted">
        On{" "}
        <a
          href={evidence.page_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink break-all underline"
        >
          {pageLabel(evidence.page_url)}
        </a>
        {evidence.fetched_at && (
          <>, fetched {fetchedFormat.format(new Date(evidence.fetched_at))}</>
        )}
        . {note}
      </p>
      <a
        href={fragmentUrl(evidence.page_url, evidence.span)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-bold underline"
      >
        Open the page at this sentence
      </a>
      <CorrectionNote fetchedAt={evidence.fetched_at} />
    </div>
  );
}
