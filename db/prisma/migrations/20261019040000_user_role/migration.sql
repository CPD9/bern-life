-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('member', 'admin');

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'member';
