-- AlterTable: add Telegram integration fields to users
ALTER TABLE "users" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "users" ADD COLUMN "telegramNotifyMode" TEXT;
ALTER TABLE "users" ADD COLUMN "telegramLinkToken" TEXT;

-- CreateIndex: link tokens must be unique (NULLs are exempt in PostgreSQL)
CREATE UNIQUE INDEX "users_telegramLinkToken_key" ON "users"("telegramLinkToken");
