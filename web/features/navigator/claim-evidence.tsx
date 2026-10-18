import type { Claim } from "@/infrastructure/contract-types.generated";
import { fragmentUrl } from "./text-fragment";

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

function pageLabel(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
}

export function EvidencePanel({ claim, id }: { claim: Claim; id: string }) {
  const { evidence } = claim;
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
        . {methodText[claim.method]}
      </p>
      <a
        href={fragmentUrl(evidence.page_url, evidence.span)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary font-bold underline"
      >
        Open the page at this sentence
      </a>
    </div>
  );
}
