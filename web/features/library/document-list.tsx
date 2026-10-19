"use client";

import { useRef } from "react";
import type { LibraryDocument } from "./library-documents";
import type { DocumentsState } from "./use-documents";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/Zurich",
});

const visibilityText: Record<LibraryDocument["visibility"], string> = {
  private: "Only you",
  members: "Signed-in members",
  public: "Anyone with the link",
};

export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentTrace({ document }: { document: LibraryDocument }) {
  const rows: [string, string][] = [
    ["sha256", document.sha256],
    ["Size", sizeText(document.size)],
    ["Pages", String(document.pages)],
    ["Uploaded by", `${document.owner.displayName} (@${document.owner.handle})`],
    ["Date", dateFormat.format(new Date(document.createdAt))],
    ["Visible to", visibilityText[document.visibility]],
  ];
  return (
    <li className="bg-chip flex flex-col gap-2 rounded-2xl p-4 text-sm">
      <a
        href={`/api/documents/${encodeURIComponent(document.id)}/file`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-extrabold break-all underline"
      >
        {document.fileName}
      </a>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted font-bold">{term}</dt>
            <dd className={term === "sha256" ? "font-mono text-xs break-all" : ""}>{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function statusText(state: DocumentsState): string {
  switch (state.status) {
    case "loading":
      return "Loading your documents…";
    case "signed-out":
      return "Sign in to see your documents.";
    case "not-connected":
      return "Documents are not connected yet.";
    case "failed":
      return "We could not load your documents.";
    case "ok": {
      const count = state.documents.length;
      if (count === 0) return "No documents uploaded to your account yet.";
      return count === 1 ? "1 document" : `${count} documents`;
    }
  }
}

type DocumentListProps = { state: DocumentsState; onRetry: () => void };

/** A short status line is what screen readers hear; the list itself is read only on request. */
export function DocumentList({ state, onRetry }: DocumentListProps) {
  const statusRef = useRef<HTMLParagraphElement>(null);

  function retry() {
    // The button goes away while loading, so focus waits on the status line.
    statusRef.current?.focus();
    onRetry();
  }

  return (
    <div className="flex flex-col gap-3">
      <p ref={statusRef} role="status" tabIndex={-1} className="text-muted">
        {statusText(state)}
      </p>
      {state.status === "signed-out" && (
        <a href="/account" className="self-start font-bold underline">
          Sign in or join
        </a>
      )}
      {state.status === "failed" && (
        <button
          type="button"
          onClick={retry}
          className="bg-chip-selected text-chip-selected-ink rounded-pill self-start px-5 py-2 font-bold"
        >
          Try again
        </button>
      )}
      {state.status === "ok" && state.documents.length > 0 && (
        <ul aria-label="Your documents" className="flex flex-col gap-3">
          {state.documents.map((document) => (
            <DocumentTrace key={document.id} document={document} />
          ))}
        </ul>
      )}
    </div>
  );
}
