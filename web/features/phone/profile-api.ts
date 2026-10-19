// The Settings app's side of /api/auth/me and /api/auth/me/profile. The profile route replaces
// the whole profile, so a visibility change sends the stored profile back with only that field
// changed. The session cookie is HttpOnly: this code never sees the token.
export type ProfileVisibility = "private" | "members" | "public";

export type MemberProfile = {
  readonly role: string | null;
  readonly goal: string | null;
  readonly expertise: readonly string[];
  readonly visibility: ProfileVisibility;
  readonly avatar: Readonly<Record<string, unknown>> | null;
};

export type MemberAccount = {
  readonly handle: string;
  readonly displayName: string;
  readonly profile: MemberProfile | null;
};

export type AccountLoad =
  | { readonly status: "signed-in"; readonly account: MemberAccount }
  | { readonly status: "signed-out" }
  | { readonly status: "not-connected" }
  | { readonly status: "failed" };

export type ProfileSave = "saved" | "signed-out" | "not-connected" | "failed";

export interface ProfileApi {
  load(): Promise<AccountLoad>;
  save(profile: MemberProfile): Promise<ProfileSave>;
}

export type Fetch = (path: string, init: RequestInit) => Promise<Response>;

const emptyProfile: MemberProfile = {
  role: null,
  goal: null,
  expertise: [],
  visibility: "private",
  avatar: null,
};

/** The body PUT /api/auth/me/profile takes: the profile as stored, with the new visibility. */
export function withVisibility(profile: MemberProfile | null, visibility: ProfileVisibility) {
  const { role, goal, expertise, avatar } = profile ?? emptyProfile;
  return { role, goal, expertise, visibility, avatar };
}

export function profileApiOver(send: Fetch): ProfileApi {
  return {
    load: async () => {
      try {
        const response = await send("/api/auth/me", { method: "GET" });
        if (response.status === 401) return { status: "signed-out" };
        if (response.status === 404) return { status: "not-connected" };
        if (!response.ok) return { status: "failed" };
        const body = (await response.json()) as {
          user: { handle: string; displayName: string };
          profile: MemberProfile | null;
        };
        const { handle, displayName } = body.user;
        return { status: "signed-in", account: { handle, displayName, profile: body.profile } };
      } catch {
        return { status: "failed" };
      }
    },
    save: async (profile) => {
      try {
        const response = await send("/api/auth/me/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(withVisibility(profile, profile.visibility)),
        });
        if (response.ok) return "saved";
        if (response.status === 401) return "signed-out";
        return response.status === 404 ? "not-connected" : "failed";
      } catch {
        return "failed";
      }
    },
  };
}

export const httpProfileApi: ProfileApi = profileApiOver((path, init) => fetch(path, init));
