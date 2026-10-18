// The SQL behind documents. Who may see a document is part of the query that reads it: the owner
// always, any signed-in account for `members`, anyone for `public`. Not visible and not there look
// the same to the caller.
import type { Db } from "@/infrastructure/db";
import type { DocumentView, Visibility } from "./types";
import type { Upload } from "./upload";

type Row = {
  id: string;
  fileName: string;
  sha256: string;
  size: number;
  pages: number;
  visibility: Visibility;
  createdAt: Date;
  handle: string;
  displayName: string;
  mine: boolean;
};

function view(row: Row): DocumentView {
  return {
    id: row.id,
    fileName: row.fileName,
    sha256: row.sha256,
    size: row.size,
    pages: row.pages,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    owner: { handle: row.handle, displayName: row.displayName },
    mine: row.mine,
  };
}

function selected(db: Db, viewer: string | null) {
  return db`d.id, d.file_name as "fileName", d.sha256, d.size, d.pages,
            d.visibility::text as visibility, d.created_at as "createdAt",
            u.handle, u.display_name as "displayName",
            coalesce(d.owner_id = ${viewer}::uuid, false) as mine`;
}

export async function insertDocument(
  db: Db,
  owner: string,
  upload: Upload,
  now: Date,
): Promise<DocumentView> {
  const [row] = await db<Row[]>`
    with d as (
      insert into document (id, owner_id, file_name, sha256, size, pages, mime, visibility, created_at)
      values (gen_random_uuid(), ${owner}, ${upload.fileName}, ${upload.sha256}, ${upload.size},
              ${upload.pages}, 'application/pdf', ${upload.visibility}, ${now})
      returning *)
    select ${selected(db, owner)} from d join app_user u on u.id = d.owner_id`;
  return view(row as Row);
}

export async function documentsOf(db: Db, me: string): Promise<DocumentView[]> {
  const rows = await db<Row[]>`
    select ${selected(db, me)} from document d join app_user u on u.id = d.owner_id
    where d.owner_id = ${me}
    order by d.created_at desc, d.id`;
  return rows.map(view);
}

/** The document when `viewer` (null when signed out) may see it, otherwise null. */
export async function visibleDocument(
  db: Db,
  viewer: string | null,
  id: string,
): Promise<DocumentView | null> {
  const [row] = await db<Row[]>`
    select ${selected(db, viewer)} from document d join app_user u on u.id = d.owner_id
    where d.id = ${id}
      and (d.visibility = 'public'
           or (d.visibility = 'members' and ${viewer}::uuid is not null)
           or d.owner_id = ${viewer}::uuid)`;
  return row === undefined ? null : view(row);
}

/** Deletes your own document's row and returns its file's hash; null when it is not yours. */
export async function deleteOwnRow(db: Db, me: string, id: string): Promise<string | null> {
  const [row] = await db<{ sha256: string }[]>`
    delete from document where id = ${id} and owner_id = ${me} returning sha256`;
  return row?.sha256 ?? null;
}

export async function hashInUse(db: Db, sha256: string): Promise<boolean> {
  const [row] = await db`select 1 from document where sha256 = ${sha256} limit 1`;
  return row !== undefined;
}

/** Held until the transaction ends, so uploads and deletes of the same bytes take turns. */
export async function lockHash(db: Db, sha256: string): Promise<void> {
  await db`select pg_advisory_xact_lock(hashtextextended(${sha256}, 0))`;
}
