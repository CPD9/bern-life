import { extractText, getDocumentProxy } from "unpdf";
import type { ReadPdf } from "./brief-text";

// The page count is checked before any text is extracted, so a long PDF costs one parse only.
export const readPdf: ReadPdf = async (bytes, maxPages) => {
  const pdf = await getDocumentProxy(bytes);
  try {
    if (pdf.numPages > maxPages) return { pages: pdf.numPages, text: null };
    const { text } = await extractText(pdf, { mergePages: true });
    return { pages: pdf.numPages, text };
  } finally {
    await pdf.loadingTask.destroy();
  }
};
