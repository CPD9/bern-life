// The JSON body of a proxied POST, read only up to a byte limit: a declared length over the limit is
// refused unread, and a streamed body is cancelled as soon as it passes the limit, so no request
// holds more than the limit in memory. Only application/json is read. A browser sends that type to
// another site only after a preflight, which these routes never answer, so a page elsewhere cannot
// post to them through the visitor's browser.

export type JsonBody =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly response: Response };

const refused = (status: number, reason?: string): JsonBody => ({
  ok: false,
  response: Response.json({ error: "bad_request", ...(reason ? { reason } : {}) }, { status }),
});

function isJson(headers: Headers): boolean {
  const type = headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return type === "application/json";
}

function declaredOver(headers: Headers, maxBytes: number): boolean {
  const declared = Number(headers.get("content-length"));
  return Number.isFinite(declared) && declared > maxBytes;
}

/** The body as text, or null when it passes `maxBytes`. */
async function textUpTo(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<string | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    bytes += chunk.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function parsed(text: string): JsonBody {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return refused(400);
  }
}

export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBody> {
  if (!isJson(request.headers)) return refused(415);
  if (declaredOver(request.headers, maxBytes)) return refused(413, "too_large");
  if (request.body === null) return refused(400);
  let text: string | null;
  try {
    text = await textUpTo(request.body, maxBytes);
  } catch {
    return refused(400);
  }
  return text === null ? refused(413, "too_large") : parsed(text);
}
