import { engine } from "@/infrastructure/engine";
import { guardEngine } from "@/infrastructure/engine-guard";
import { proxySearch } from "./proxy";

export function POST(request: Request): Promise<Response> {
  return proxySearch(request, { engine, guard: guardEngine });
}
