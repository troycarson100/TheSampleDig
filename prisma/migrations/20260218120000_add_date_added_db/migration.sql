-- AlterTable
ALTER TABLE "samples" ADD COLUMN IF NOT EXISTS "date_added_db" TIMESTAMP(3);
