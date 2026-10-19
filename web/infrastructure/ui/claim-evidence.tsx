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

/** The README section on having a page or a claim corrected or removed. */
export const CORRECTIONS_URL = "https://github.com/CPD9/bern-life#corrections-and-removal";

type CorrectionNoteProps = {
  fetchedAt?: string | null | undefined;
  /** What is quoted, as the note names it: a sentence unless said otherwise. */
  quoted?: "sentence" | "address";
};

/**
 * How a quoted sentence gets corrected or removed, folded away under one quiet line. It only
 * explains: nothing here sends anything, and its one link opens the README's section.
 */
export function CorrectionNote({ fetchedAt, quoted = "sentence" }: CorrectionNoteProps) {
  const when = fetchedAt
    ? `as it read on ${fetchedFormat.format(new Date(fetchedAt))}`
    : "as Bern Life stored it";
  return (
    <details className="text-muted">
      <summary className="w-fit cursor-pointer">Wrong or outdated?</summary>
      <p className="mt-1">
        This {quoted} is quoted from the institution&apos;s page {when}. A correction made on that
        page reaches Bern Life with the next snapshot; to ask for its removal from Bern Life, see{" "}
        <a
          href={CORRECTIONS_URL}
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
