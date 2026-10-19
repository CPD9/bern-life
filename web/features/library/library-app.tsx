"use client";

import { useId } from "react";
import { DocumentList } from "./document-list";
import { type LibraryDocumentsApi, httpLibraryDocuments } from "./library-documents";
import { itemKinds } from "./library-items";
import { type LibraryStore, browserLibrary } from "./library-store";
import { SavedSection } from "./saved-items";
import { useDocuments } from "./use-documents";
import { useLibraryItems } from "./use-library";

export type LibraryAppProps = {
  store?: LibraryStore;
  documents?: LibraryDocumentsApi;
};

const browserDocuments = httpLibraryDocuments((input, init) => fetch(input, init));

/** What you kept, each with where it came from: saved items on this device, documents on your
 *  account. */
export function LibraryApp({
  store = browserLibrary(),
  documents = browserDocuments,
}: LibraryAppProps) {
  const items = useLibraryItems(store);
  const { state, retry } = useDocuments(documents);
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted text-sm">
        Saved items stay in this browser on this device. Documents belong to your account.
      </p>
      {itemKinds.map((kind) => (
        <SavedSection key={kind} kind={kind} items={items} onRemove={store.remove} />
      ))}
      <section aria-labelledby={`${id}-documents`} className="flex flex-col gap-3">
        <h3 id={`${id}-documents`} className="text-lg font-extrabold">
          Documents
        </h3>
        <DocumentList state={state} onRetry={retry} />
      </section>
    </div>
  );
}
