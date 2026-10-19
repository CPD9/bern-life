// Component tests render into happy-dom. The runtime's own web primitives stay in place, so
// server code under test (URL parsing, fetch, form data) behaves as it does in production.
// Testing Library binds `screen` to the document on import, so it loads after registration.
import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const runtimePrimitives = {
  URL,
  URLSearchParams,
  fetch,
  Request,
  Response,
  Headers,
  FormData,
  File,
  Blob,
  AbortController,
  AbortSignal,
  TextEncoder,
  TextDecoder,
};

GlobalRegistrator.register();
Object.assign(globalThis, runtimePrimitives);

const { cleanup } = await import("@testing-library/react");
afterEach(cleanup);

// happy-dom offers no WebGL, so every 3D scene would show its fallback; tests of a scene's
// fallback say so themselves (`assumeWebgl(false)`) and put it back afterwards.
const { assumeWebgl } = await import("@/infrastructure/webgl");
assumeWebgl(true);
