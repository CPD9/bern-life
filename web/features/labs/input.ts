// What the labs routes accept. Text is trimmed and length-checked; control characters are refused.
import type { LabInput } from "./types";

const CONTROL = /\p{Cc}/u;
const LIMITS = { name: 80, unit: 120, description: 500, profileId: 200, code: 64 } as const;

function fields(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max && !CONTROL.test(trimmed) ? trimmed : null;
}

/** null when absent or empty, undefined when present but not acceptable. */
function optional(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return text(value, max) ?? undefined;
}

export function parseLab(body: unknown): LabInput | null {
  const { name, unit, description } = fields(body);
  const parsed = {
    name: text(name, LIMITS.name),
    unit: optional(unit, LIMITS.unit),
    description: optional(description, LIMITS.description),
  };
  if (parsed.name === null || parsed.unit === undefined || parsed.description === undefined)
    return null;
  return { name: parsed.name, unit: parsed.unit, description: parsed.description };
}

export function parseCode(body: unknown): string | null {
  return text(fields(body).code, LIMITS.code);
}

export function parseProfileId(body: unknown): string | null {
  return text(fields(body).profileId, LIMITS.profileId);
}
