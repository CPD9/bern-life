// Request bodies for the auth routes, parsed into exact shapes or refused. No email is asked for.
export const HANDLE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;
const NAME_MAX = 60;
const PROFILE_TEXT_MAX = 120;
const EXPERTISE_MAX = 20;
const AVATAR_BYTES_MAX = 4096;
const CONTROL = /\p{Cc}/u;
export const VISIBILITIES = ["private", "members", "public"] as const;

export type Visibility = (typeof VISIBILITIES)[number];
export type SignUp = { invite: string; handle: string; displayName: string; password: string };
export type SignIn = { handle: string; password: string };
export type ProfileInput = {
  role: string | null;
  goal: string | null;
  expertise: string[];
  visibility: Visibility;
  avatar: Record<string, unknown> | null;
};

function record(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max && !CONTROL.test(trimmed) ? trimmed : null;
}

function handle(value: unknown): string | null {
  const lowered = typeof value === "string" ? value.trim().toLowerCase() : "";
  return HANDLE.test(lowered) ? lowered : null;
}

export function password(value: unknown): string | null {
  return typeof value === "string" && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
    ? value
    : null;
}

export function parseSignUp(body: unknown): SignUp | null {
  const fields = record(body);
  if (fields === null) return null;
  const parsed = {
    invite: text(fields.invite, 64),
    handle: handle(fields.handle),
    displayName: text(fields.displayName, NAME_MAX),
    password: password(fields.password),
  };
  const { invite, displayName } = parsed;
  if (
    invite === null ||
    parsed.handle === null ||
    displayName === null ||
    parsed.password === null
  ) {
    return null;
  }
  return { invite, handle: parsed.handle, displayName, password: parsed.password };
}

export function parseSignIn(body: unknown): SignIn | null {
  const fields = record(body);
  const parsedHandle = handle(fields?.handle);
  const parsedPassword = typeof fields?.password === "string" ? fields.password : null;
  if (parsedHandle === null || parsedPassword === null) return null;
  return { handle: parsedHandle, password: parsedPassword };
}

function optionalText(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return text(value, PROFILE_TEXT_MAX) ?? undefined;
}

export function parseProfile(body: unknown): ProfileInput | null {
  const fields = record(body);
  if (fields === null) return null;
  const role = optionalText(fields.role);
  const goal = optionalText(fields.goal);
  const expertise = Array.isArray(fields.expertise)
    ? fields.expertise.map((e) => text(e, NAME_MAX))
    : [];
  const visibility = VISIBILITIES.find((v) => v === (fields.visibility ?? "private"));
  const avatar =
    fields.avatar === undefined || fields.avatar === null ? null : record(fields.avatar);
  const avatarFits = avatar === null || JSON.stringify(avatar).length <= AVATAR_BYTES_MAX;
  if (role === undefined || goal === undefined || visibility === undefined || !avatarFits)
    return null;
  if (expertise.length > EXPERTISE_MAX || expertise.some((e) => e === null)) return null;
  if (fields.avatar !== undefined && fields.avatar !== null && avatar === null) return null;
  return { role, goal, expertise: expertise as string[], visibility, avatar };
}
