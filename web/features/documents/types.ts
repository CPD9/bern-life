export const VISIBILITIES = ["private", "members", "public"] as const;

/** `members` is any signed-in account (sign-up is invite-only); `public` is anyone. */
export type Visibility = (typeof VISIBILITIES)[number];

/** What a viewer learns about a document; the bytes come from its own file route. */
export type DocumentView = {
  id: string;
  fileName: string;
  sha256: string;
  size: number;
  pages: number;
  visibility: Visibility;
  createdAt: string;
  owner: { handle: string; displayName: string };
  mine: boolean;
};
