import { crossSite, requestUser } from "@/features/accounts/http";
import { addDocument } from "@/features/documents/documents";
import { uploads } from "@/features/documents/files";
import { failure } from "@/features/documents/http";
import { countPdfPages } from "@/features/documents/pdf-pages";
import { documentsOf } from "@/features/documents/store";
import { readUpload, uploadTooLarge } from "@/features/documents/upload";
import { db } from "@/infrastructure/db";

export async function GET(request: Request): Promise<Response> {
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  return Response.json({ documents: await documentsOf(db(), user.id) });
}

/** Uploads a PDF (form fields `file` and optional `visibility`, private by default). */
export async function POST(request: Request): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  if (uploadTooLarge(request.headers)) return failure("too_large");
  const form = await request.formData().catch(() => null);
  if (form === null) return failure("bad_request");
  const read = await readUpload(form, countPdfPages);
  if (!read.ok) return failure(read.reason);
  const document = await addDocument(db(), uploads(), user.id, read.upload, new Date());
  return Response.json({ document }, { status: 201 });
}
