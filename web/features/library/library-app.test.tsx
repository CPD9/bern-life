import { describe, expect, test } from "bun:test";
import { act, render, screen, within } from "@testing-library/react";
import type { DocumentsOutcome, LibraryDocumentsApi } from "./library-documents";
import { LibraryApp } from "./library-app";
import { memoryStore, savedItem } from "./testing";

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

async function renderLibrary(outcome: DocumentsOutcome, store = memoryStore()) {
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
    const store = memoryStore();
    store.save(savedItem("demo-call", "opportunity"));
    await renderLibrary({ status: "signed-out" }, store);
    expect(screen.getByText(/Sign in to see your documents/)).toBeTruthy();
    const saved = screen.getByRole("list", { name: "Saved opportunities" });
    expect(within(saved).getByText("“Demo demo-call leads the sensor lab.”").tagName).toBe("MARK");
    const source = within(saved).getByRole("link", {
      name: "www.example-institute.test/demo-call",
    });
    expect(source.getAttribute("href")).toBe("https://www.example-institute.test/demo-call");
    act(() => within(saved).getByRole("button", { name: "Remove Demo demo-call" }).click());
    expect(store.get()).toEqual([]);
    expect(screen.getByText(/No saved opportunities yet/)).toBeTruthy();
  });

  test("an empty library says so plainly, and how to save an opportunity", async () => {
    await renderLibrary({ status: "ok", documents: [] });
    expect(screen.getByText("No saved profiles yet.")).toBeTruthy();
    expect(screen.getByText("No saved pages yet.")).toBeTruthy();
    expect(
      screen.getByText(
        "No saved opportunities yet. Save one with “Save to library” in Opportunities.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("No documents uploaded to your account yet.")).toBeTruthy();
  });

  test("a saved sentence says how it is corrected or removed, and that the copy stays", async () => {
    const store = memoryStore();
    store.save(savedItem("demo-a"));
    await renderLibrary({ status: "signed-out" }, store);
    const note = screen.getByText("Wrong or outdated?").closest("details")!;
    expect(note.textContent).toContain("quoted from the institution's page as Bern Life stored it");
    // A removal from Bern Life never reaches what a browser keeps.
    expect(note.textContent).toContain(
      "Your saved copy stays as it is in this browser until you remove it;",
    );
    expect(note.textContent).not.toContain("next snapshot");
    expect(note.querySelector("a")!.getAttribute("href")).toBe("/corrections");
  });

  test("removing moves focus to the next item, then the previous, then the heading", async () => {
    const store = memoryStore();
    for (const ref of ["demo-a", "demo-b", "demo-c"]) store.save(savedItem(ref));
    await renderLibrary({ status: "signed-out" }, store);
    const removeButton = (ref: string) =>
      screen.getByRole("button", { name: `Remove Demo ${ref}` });
    const section = screen.getByRole("region", { name: "Profiles" });

    act(() => removeButton("demo-b").click());
    expect(document.activeElement).toBe(removeButton("demo-c"));
    expect(within(section).getByRole("status").textContent).toBe("Removed Demo demo-b");

    act(() => removeButton("demo-c").click());
    expect(document.activeElement).toBe(removeButton("demo-a"));

    act(() => removeButton("demo-a").click());
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Profiles" }));
    expect(within(section).getByRole("status").textContent).toBe("Removed Demo demo-a");
    expect(store.get()).toEqual([]);
  });

  test("documents that failed load again on Try again, with focus kept on the status", async () => {
    const outcomes: DocumentsOutcome[] = [
      { status: "failed" },
      { status: "ok", documents: [demoDocument] },
    ];
    let calls = 0;
    const documents = { list: async () => outcomes[calls++] ?? { status: "failed" as const } };
    await act(async () => {
      render(<LibraryApp store={memoryStore()} documents={documents} />);
    });
    const status = screen.getByText("We could not load your documents.");
    expect(status.getAttribute("role")).toBe("status");
    await act(async () => {
      screen.getByRole("button", { name: "Try again" }).click();
    });
    expect(calls).toBe(2);
    expect(status.textContent).toBe("1 document");
    expect(document.activeElement).toBe(status);
    expect(screen.getByRole("list", { name: "Your documents" })).toBeTruthy();
  });

  test("a documents API that is not there yet is named as not connected", async () => {
    await renderLibrary({ status: "not-connected" });
    expect(screen.getByText("Documents are not connected yet.")).toBeTruthy();
  });
});
