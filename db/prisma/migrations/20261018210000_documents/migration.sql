-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('private', 'members', 'public');

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size" INTEGER NOT NULL,
    "pages" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'private',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_owner_id_created_at_idx" ON "document"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "document_sha256_idx" ON "document"("sha256");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Not expressible in Prisma: what a stored document may be, enforced by the database too.
ALTER TABLE "document" ADD CONSTRAINT "document_is_pdf" CHECK ("mime" = 'application/pdf');
ALTER TABLE "document" ADD CONSTRAINT "document_sha256_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "document" ADD CONSTRAINT "document_size_limit" CHECK ("size" BETWEEN 1 AND 10485760);
ALTER TABLE "document" ADD CONSTRAINT "document_has_pages" CHECK ("pages" >= 1);
ALTER TABLE "document" ADD CONSTRAINT "document_file_name_length" CHECK (char_length("file_name") BETWEEN 1 AND 255);
