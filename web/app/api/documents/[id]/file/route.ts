import { requestUser } from "@/features/accounts/http";
import { uploads } from "@/features/documents/files";
import { failure, fileHeaders } from "@/features/documents/http";
import { visibleDocument } from "@/features/documents/store";
import { isId } from "@/features/messages/notice";
import { db } from "@/infrastructure/db";

type Context = { params: Promise<{ id: string }> };

/** The PDF itself, to its owner or to the viewers its visibility allows. */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { id } = await params;
  if (!isId(id)) return failure("not_found");
  const user = await requestUser(request);
  const document = await visibleDocument(db(), user?.id ?? null, id);
  if (document === null) return failure("not_found");
  const bytes = await uploads().read(document.sha256);
  if (bytes === null) return failure("not_found");
  return new Response(bytes, { headers: fileHeaders(document) });
}
