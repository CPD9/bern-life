import { connection } from "next/server";
import { engine } from "@/infrastructure/engine";
import { placePeople } from "../../../proxy";

type Context = { params: Promise<{ source: string; host: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  // The people reflect the loaded snapshot, so they are asked at request time, never at build.
  await connection();
  return placePeople(await params, engine);
}
