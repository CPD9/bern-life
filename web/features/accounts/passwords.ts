// argon2id with the OWASP Password Storage Cheat Sheet minimum: 19 MiB of memory, 2 passes, 1 lane.
// The algorithm is the library's const enum Algorithm.Argon2id (2), which isolatedModules cannot
// import; a test pins the parameters through the stored hash's prefix.
import { hash, verify, type Options } from "@node-rs/argon2";
import { randomUUID } from "node:crypto";

export const ARGON2: Options = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2);
}

export function verifyPassword(stored: string, password: string): Promise<boolean> {
  return verify(stored, password);
}

let decoy: Promise<string> | undefined;

// Checked when a handle is unknown, so a wrong handle takes as long as a wrong password.
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomUUID());
  return decoy;
}
