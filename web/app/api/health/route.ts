import { connection } from "next/server";
import { engine } from "@/infrastructure/engine";
import { engineResponse } from "@/infrastructure/engine-response";

export async function GET(): Promise<Response> {
  // Health is asked at request time, never baked into the build.
  await connection();
  return engineResponse(await engine().health());
}
