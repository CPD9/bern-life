import { readBriefText } from "@/infrastructure/brief-text";
import { engine } from "@/infrastructure/engine";
import { engineResponse } from "@/infrastructure/engine-response";
import { readPdf } from "@/infrastructure/pdf-text";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (form === null) return Response.json({ error: "bad_request" }, { status: 400 });
  const brief = await readBriefText(form, readPdf);
  if (!brief.ok) {
    return Response.json({ error: "bad_request", reason: brief.reason }, { status: 400 });
  }
  return engineResponse(await engine().brief(brief.text));
}
