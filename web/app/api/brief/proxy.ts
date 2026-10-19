import { readBriefText, uploadTooLarge } from "@/infrastructure/brief-text";
import { engineResponse } from "@/infrastructure/engine-response";
import type { EngineProxy } from "@/infrastructure/engine-types";
import { readPdf } from "@/infrastructure/pdf-text";

export async function proxyBrief(request: Request, proxy: EngineProxy): Promise<Response> {
  const access = await proxy.guard(request, "brief");
  if (!access.ok) return access.response;
  if (uploadTooLarge(request.headers)) {
    return Response.json({ error: "bad_request", reason: "too_large" }, { status: 413 });
  }
  const form = await request.formData().catch(() => null);
  if (form === null) return Response.json({ error: "bad_request" }, { status: 400 });
  const brief = await readBriefText(form, readPdf);
  if (!brief.ok) {
    return Response.json({ error: "bad_request", reason: brief.reason }, { status: 400 });
  }
  return engineResponse(await proxy.engine().brief(brief.text, { live: access.live }));
}
