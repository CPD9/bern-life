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

type DocumentListProps = { state: DocumentsState; onRetry: () => void };

export function DocumentList({ state, onRetry }: DocumentListProps) {
  switch (state.status) {
    case "loading":
      return <p className="text-muted">Loading your documents…</p>;
    case "signed-out":
      return (
        <p>
          Sign in to see your documents.{" "}
          <a href="/account" className="font-bold underline">
            Sign in or join
          </a>
        </p>
      );
    case "not-connected":
      return <p>Documents are not connected yet.</p>;
    case "failed":
      return (
        <div className="flex flex-col gap-2">
          <p>We could not load your documents.</p>
          <button
            type="button"
            onClick={onRetry}
            className="bg-chip-selected text-chip-selected-ink rounded-pill self-start px-5 py-2 font-bold"
          >
            Try again
          </button>
        </div>
      );
    case "ok":
      return state.documents.length === 0 ? (
        <p className="text-muted">No documents uploaded to your account yet.</p>
      ) : (
        <ul aria-label="Your documents" className="flex flex-col gap-3">
          {state.documents.map((document) => (
            <DocumentTrace key={document.id} document={document} />
          ))}
        </ul>
      );
  }
}
