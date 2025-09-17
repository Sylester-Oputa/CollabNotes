/*
  Warnings:

  - You are about to drop the column `emailEnabled` on the `notification_settings` table. All the data in the column will be lost.
  - You are about to drop the column `enabled` on the `notification_settings` table. All the data in the column will be lost.
  - You are about to drop the column `pushEnabled` on the `notification_settings` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `notification_settings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `notification_settings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `notification_settings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."notification_settings" DROP CONSTRAINT "notification_settings_userId_fkey";

-- DropIndex
DROP INDEX "public"."notification_settings_userId_type_key";

-- AlterTable
ALTER TABLE "public"."notification_settings" DROP COLUMN "emailEnabled",
DROP COLUMN "enabled",
DROP COLUMN "pushEnabled",
DROP COLUMN "type",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "desktopNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "groupNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mentionNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "messageNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reactionNotifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "public"."notification_settings"("userId");

-- AddForeignKey
ALTER TABLE "public"."notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
