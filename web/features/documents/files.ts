// The uploaded files, one per sha256 under <data dir>/uploads: outside git and outside the
// bundle. A file is written under a temporary name and renamed, so no reader sees half of one.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "@/infrastructure/env";

export type FileStore = {
  write(sha256: string, bytes: Uint8Array): Promise<void>;
  /** The bytes, or null when no file has that hash. */
  read(sha256: string): Promise<Uint8Array<ArrayBuffer> | null>;
  remove(sha256: string): Promise<void>;
};

const SHA256 = /^[0-9a-f]{64}$/;

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function diskFiles(dir: string): FileStore {
  // Only a hash ever becomes a file name, so no input can point outside `dir`.
  const named = (sha256: string) => {
    if (!SHA256.test(sha256)) throw new Error("not a sha256");
    return path.join(dir, sha256);
  };
  return {
    async write(sha256, bytes) {
      const target = named(sha256);
      await mkdir(dir, { recursive: true });
      const partial = `${target}.${randomUUID()}.part`;
      await writeFile(partial, bytes, { flag: "wx" });
      await rename(partial, target);
    },
    async read(sha256) {
      try {
        return new Uint8Array(await readFile(named(sha256)));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async remove(sha256) {
      await rm(named(sha256), { force: true });
    },
  };
}

export function uploads(): FileStore {
  return diskFiles(path.join(dataDir(), "uploads"));
}
