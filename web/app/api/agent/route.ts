import { engine } from "@/infrastructure/engine";
import { guardEngine } from "@/infrastructure/engine-guard";
import { proxyAgent } from "./proxy";

/** One Navigator agent turn: the conversation so far, newest last (contracts/api.md). */
export function POST(request: Request): Promise<Response> {
  return proxyAgent(request, { engine, guard: guardEngine });
}
