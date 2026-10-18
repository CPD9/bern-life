-- CreateEnum
CREATE TYPE "LabRole" AS ENUM ('lead', 'member');

-- AlterTable
ALTER TABLE "user_profile" ADD COLUMN     "office_layout" JSONB,
ADD COLUMN     "office_plot" JSONB,
ADD COLUMN     "visit_visibility" "ProfileVisibility" NOT NULL DEFAULT 'private';

-- CreateTable
CREATE TABLE "lab" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "lead_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_member" (
    "lab_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "LabRole" NOT NULL DEFAULT 'member',
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_member_pkey" PRIMARY KEY ("lab_id","user_id")
);

-- CreateTable
CREATE TABLE "lab_invite" (
    "code_hash" CHAR(64) NOT NULL,
    "lab_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_invite_pkey" PRIMARY KEY ("code_hash")
);

-- CreateTable
CREATE TABLE "lab_listing" (
    "lab_id" UUID NOT NULL,
    "profile_id" TEXT NOT NULL,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_listing_pkey" PRIMARY KEY ("lab_id","profile_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_lead_id_key" ON "lab"("lead_id");

-- CreateIndex
CREATE INDEX "lab_member_user_id_idx" ON "lab_member"("user_id");

-- CreateIndex
CREATE INDEX "lab_invite_lab_id_idx" ON "lab_invite"("lab_id");

-- CreateIndex
CREATE INDEX "lab_listing_added_by_idx" ON "lab_listing"("added_by");

-- AddForeignKey
ALTER TABLE "lab" ADD CONSTRAINT "lab_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_member" ADD CONSTRAINT "lab_member_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_member" ADD CONSTRAINT "lab_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_invite" ADD CONSTRAINT "lab_invite_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_listing" ADD CONSTRAINT "lab_listing_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_listing" ADD CONSTRAINT "lab_listing_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Not expressible in Prisma: the limits on what a lab and an office carry, enforced by the database too.
ALTER TABLE "lab" ADD CONSTRAINT "lab_name_length" CHECK (char_length("name") BETWEEN 1 AND 80);
ALTER TABLE "lab" ADD CONSTRAINT "lab_unit_length" CHECK (char_length("unit") <= 120);
ALTER TABLE "lab" ADD CONSTRAINT "lab_description_length" CHECK (char_length("description") <= 500);
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_office_size" CHECK (octet_length("office_plot"::text) <= 2048 AND octet_length("office_layout"::text) <= 16384);
