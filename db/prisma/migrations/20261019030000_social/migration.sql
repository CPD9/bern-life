-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('pending', 'accepted', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('message', 'connection');

-- CreateTable
CREATE TABLE "connection_request" (
    "id" UUID NOT NULL,
    "from_id" UUID NOT NULL,
    "to_id" UUID NOT NULL,
    "pair_key" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(3),

    CONSTRAINT "connection_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "ref" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "user_id" UUID NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connection_request_pair_key_key" ON "connection_request"("pair_key");

-- CreateIndex
CREATE INDEX "connection_request_from_id_status_idx" ON "connection_request"("from_id", "status");

-- CreateIndex
CREATE INDEX "connection_request_to_id_status_idx" ON "connection_request"("to_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_unread_key" ON "notification"("user_id", "kind", "ref") WHERE (read_at IS NULL);

-- CreateIndex
CREATE INDEX "notification_user_id_created_at_idx" ON "notification"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_kind_ref_idx" ON "notification"("kind", "ref");

-- AddForeignKey
ALTER TABLE "connection_request" ADD CONSTRAINT "connection_request_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connection_request" ADD CONSTRAINT "connection_request_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Not expressible in Prisma: the length of a connection note, a pair key made of the two ids, and
-- nobody asking themselves, enforced by the database too.
ALTER TABLE "connection_request" ADD CONSTRAINT "connection_request_note_length" CHECK (char_length("note") <= 280);
ALTER TABLE "connection_request" ADD CONSTRAINT "connection_request_not_self" CHECK ("from_id" <> "to_id");
ALTER TABLE "connection_request" ADD CONSTRAINT "connection_request_pair_key" CHECK ("pair_key" = least("from_id", "to_id")::text || ':' || greatest("from_id", "to_id")::text);
