import type { ReactNode } from "react";

export type PhoneApp = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly tile: string;
  readonly content: ReactNode;
  /** Sits in the dock at the bottom of the home screen. When no app sets it, the first four do. */
  readonly dock?: boolean;
  /** A count on the tile (unread messages, say). No badge for 0 or when unknown. */
  readonly badge?: number | undefined;
  /** Apps with the same folder name share one folder tile on the home grid, in the order given. */
  readonly folder?: string;
  /** One line under the folder's name when it opens, set on the folder's first app. */
  readonly folderHint?: string;
};

/** The engine's state, the same shape the HUD reads from /api/health. */
export type PhoneHealth =
  | { readonly status: "waiting" }
  | {
      readonly status: "ok";
      readonly health: {
        readonly mode: "live" | "replay" | "mock";
        readonly snapshot: string;
        readonly counts: {
          readonly pages?: number;
          readonly profiles?: number;
          readonly sources?: number;
        };
      };
    }
  | { readonly status: "offline" };

/** One in-app notification, as the notification store keeps it. */
export type PhoneNotification = {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  /** ISO 8601 instant. */
  readonly at: string;
  readonly read: boolean;
};
