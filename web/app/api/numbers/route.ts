import { connection } from "next/server";
import { engine } from "@/infrastructure/engine";
import { engineResponse } from "@/infrastructure/engine-response";

export async function GET(): Promise<Response> {
  // The numbers belong to the loaded snapshot, so they are asked at request time, never at build.
  await connection();
  return engineResponse(await engine().numbers());
}
