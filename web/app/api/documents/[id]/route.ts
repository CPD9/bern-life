import { crossSite, requestUser } from "@/features/accounts/http";
import { removeDocument } from "@/features/documents/documents";
import { uploads } from "@/features/documents/files";
import { done, failure } from "@/features/documents/http";
import { visibleDocument } from "@/features/documents/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

/** The document's metadata, for anyone its visibility allows (signed out included for public). */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  const user = await requestUser(request);
  const document = await visibleDocument(db(), user?.id ?? null, id);
  return document === null ? failure("not_found") : Response.json({ document });
}

/** Deletes your own document; its file goes with the last row that uses it. */
export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  const refused = crossSite(request);
  if (refused !== null) return refused;
  const user = await requestUser(request);
  if (user === null) return failure("unauthenticated");
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  return (await removeDocument(db(), uploads(), user.id, id)) ? done() : failure("not_found");
}
