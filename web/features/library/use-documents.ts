"use client";

import { useEffect, useState } from "react";
import type { DocumentsOutcome, LibraryDocumentsApi } from "./library-documents";

export type DocumentsState = { status: "loading" } | DocumentsOutcome;

export function useDocuments(api: LibraryDocumentsApi): {
  state: DocumentsState;
  retry: () => void;
} {
  const [state, setState] = useState<DocumentsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    void api.list().then((outcome) => {
      if (current) setState(outcome);
    });
    return () => {
      current = false;
    };
  }, [api, attempt]);

  return {
    state,
    retry: () => {
      setState({ status: "loading" });
      setAttempt((n) => n + 1);
    },
  };
}
