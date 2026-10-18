// Uploading and deleting keep the row and the file in step. Both lock the file's hash for their
// transaction, so a delete never removes a file that an upload of the same bytes has just linked.
// One file serves every row with its hash; it goes when the last of those rows goes.
import type { Sql } from "@/infrastructure/db";
import type { FileStore } from "./files";
import { deleteOwnRow, hashInUse, insertDocument, lockHash } from "./store";
import type { DocumentView } from "./types";
import type { Upload } from "./upload";

export async function addDocument(
  sql: Sql,
  files: FileStore,
  owner: string,
  upload: Upload,
  now: Date,
): Promise<DocumentView> {
  return sql.begin(async (tx) => {
    await lockHash(tx, upload.sha256);
    const document = await insertDocument(tx, owner, upload, now);
    // Written after the row, so a failed write rolls the row back with it.
    await files.write(upload.sha256, upload.bytes);
    return document;
  });
}

/** False when the document is not yours or not there. */
export async function removeDocument(
  sql: Sql,
  files: FileStore,
  me: string,
  id: string,
): Promise<boolean> {
  return sql.begin(async (tx) => {
    const sha256 = await deleteOwnRow(tx, me, id);
    if (sha256 === null) return false;
    await lockHash(tx, sha256);
    if (!(await hashInUse(tx, sha256))) await files.remove(sha256);
    return true;
  });
}
