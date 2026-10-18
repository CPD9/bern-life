import { getDocumentProxy } from "unpdf";
import type { CountPages } from "./upload";

// Parsing the document is the real check that it is a PDF, beyond its first five bytes.
export const countPdfPages: CountPages = async (bytes) => {
  const pdf = await getDocumentProxy(bytes);
  try {
    return pdf.numPages;
  } finally {
    await pdf.loadingTask.destroy();
  }
};
