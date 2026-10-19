import { engine } from "@/infrastructure/engine";
import { guardEngine } from "@/infrastructure/engine-guard";
import { proxyBrief } from "./proxy";

export function POST(request: Request): Promise<Response> {
  return proxyBrief(request, { engine, guard: guardEngine });
}
