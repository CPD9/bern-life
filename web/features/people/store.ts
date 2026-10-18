// The SQL behind the member directory and office visits. Who may be seen is part of each query:
// yourself always, a visit visibility of `members` for any signed-in viewer, `public` for anyone.
import type { Visibility } from "@/features/accounts/input";
import type { Db } from "@/infrastructure/db";
import type { Json, OfficeInput } from "./office";

export type DirectoryEntry = {
  handle: string;
  displayName: string;
  role: string | null;
  visitVisibility: Visibility;
};

export type Office = {
  handle: string;
  displayName: string;
  plot: Record<string, unknown> | null;
  layout: Json | null;
  visitVisibility: Visibility;
};

type JsonValue = Parameters<Db["json"]>[0];

function visibleTo(db: Db, viewer: string | null) {
  return db`(p.visit_visibility = 'public'
             or (p.visit_visibility = 'members' and ${viewer}::uuid is not null)
             or p.user_id = ${viewer}::uuid)`;
}

export async function saveOffice(
  db: Db,
  me: string,
  office: OfficeInput,
  now: Date,
): Promise<void> {
  const json = (value: Json | null) => (value === null ? null : db.json(value as JsonValue));
  await db`insert into user_profile (user_id, office_plot, office_layout, visit_visibility, updated_at)
    values (${me}, ${json(office.plot)}, ${json(office.layout)}, ${office.visitVisibility}, ${now})
    on conflict (user_id) do update set office_plot = excluded.office_plot,
      office_layout = excluded.office_layout, visit_visibility = excluded.visit_visibility,
      updated_at = excluded.updated_at`;
}

export async function directory(db: Db, viewer: string | null): Promise<DirectoryEntry[]> {
  return db<DirectoryEntry[]>`
    select u.handle, u.display_name as "displayName", p.role,
           p.visit_visibility::text as "visitVisibility"
    from user_profile p join app_user u on u.id = p.user_id
    where ${visibleTo(db, viewer)}
    order by u.display_name, u.handle`;
}

/** The office of `handle` when `viewer` (null when signed out) may visit it, otherwise null. */
export async function visibleOffice(
  db: Db,
  viewer: string | null,
  handle: string,
): Promise<Office | null> {
  const [office] = await db<Office[]>`
    select u.handle, u.display_name as "displayName", p.office_plot as plot,
           p.office_layout as layout, p.visit_visibility::text as "visitVisibility"
    from user_profile p join app_user u on u.id = p.user_id
    where u.handle = ${handle} and ${visibleTo(db, viewer)}`;
  return office ?? null;
}
