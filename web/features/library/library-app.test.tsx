import { describe, expect, test } from "bun:test";
import { act, render, screen, within } from "@testing-library/react";
import type { DocumentsOutcome, LibraryDocumentsApi } from "./library-documents";
import { LibraryApp } from "./library-app";
import { createLibraryStore } from "./library-store";
import { memoryStorage, savedItem } from "./testing";

function documentsAnswering(outcome: DocumentsOutcome): LibraryDocumentsApi {
  return { list: async () => outcome };
}

const demoDocument = {
  id: "doc-1",
  fileName: "demo-brief.pdf",
  sha256: "9f2c4e7a1b3d5f6e8a0c2e4f6a8b0d2f4e6a8c0e2f4a6b8d0f2e4a6c8e0f2a4b",
  size: 245760,
  pages: 3,
  visibility: "members" as const,
  createdAt: "2026-10-18T09:15:00.000Z",
  owner: { handle: "demo-mara", displayName: "Mara Demo" },
};

async function renderLibrary(
  outcome: DocumentsOutcome,
  store = createLibraryStore(() => memoryStorage()),
) {
  const documents = documentsAnswering(outcome);
  await act(async () => {
    render(<LibraryApp store={store} documents={documents} />);
  });
}

function terms(list: HTMLElement): string[][] {
  return Array.from(list.querySelectorAll("dt"), (dt) => [
    dt.textContent ?? "",
    dt.nextElementSibling?.textContent ?? "",
  ]);
}

describe("LibraryApp", () => {
  test("lists documents with their trace", async () => {
    await renderLibrary({ status: "ok", documents: [demoDocument] });
    const list = screen.getByRole("list", { name: "Your documents" });
    expect(within(list).getByRole("link", { name: "demo-brief.pdf" }).getAttribute("href")).toBe(
      "/api/documents/doc-1/file",
    );
    expect(terms(list)).toEqual([
      ["sha256", demoDocument.sha256],
      ["Size", "240.0 KB"],
      ["Pages", "3"],
      ["Uploaded by", "Mara Demo (@demo-mara)"],
      ["Date", "18 Oct 2026"],
      ["Visible to", "Signed-in members"],
    ]);
  });

  test("signed out, documents ask you to sign in and saved items still show", async () => {
    const store = createLibraryStore(() => memoryStorage());
    store.save(savedItem("demo-call", "opportunity"));
    await renderLibrary({ status: "signed-out" }, store);
    expect(screen.getByText(/Sign in to see your documents/)).toBeTruthy();
    const saved = screen.getByRole("list", { name: "Saved opportunities" });
    expect(within(saved).getByText("“Demo demo-call leads the sensor lab.”").tagName).toBe("MARK");
    expect(within(saved).getByRole("link").getAttribute("href")).toBe(
      "https://www.example-institute.test/demo-call",
    );
    act(() => within(saved).getByRole("button", { name: "Remove Demo demo-call" }).click());
    expect(store.get()).toEqual([]);
    expect(screen.getByText(/No saved opportunities yet/)).toBeTruthy();
  });

  test("an empty library says how to save something", async () => {
    await renderLibrary({ status: "ok", documents: [] });
    expect(screen.getByText(/No saved profiles yet. Save one with “Save to library”/)).toBeTruthy();
    expect(screen.getByText("No documents uploaded to your account yet.")).toBeTruthy();
  });

  test("a documents API that is not there yet is named as not connected", async () => {
    await renderLibrary({ status: "not-connected" });
    expect(screen.getByText("Documents are not connected yet.")).toBeTruthy();
  });
});
