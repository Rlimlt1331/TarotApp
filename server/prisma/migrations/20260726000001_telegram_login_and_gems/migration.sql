-- Make email and password nullable for Telegram-only accounts
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Add Telegram one-time login token fields
ALTER TABLE "users" ADD COLUMN "telegramLoginToken" TEXT;
ALTER TABLE "users" ADD COLUMN "telegramLoginTokenExpiry" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_telegramLoginToken_key" ON "users"("telegramLoginToken");

-- Add Gem balance and free reading flag to users
ALTER TABLE "users" ADD COLUMN "gemBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "freeReadingUsed" BOOLEAN NOT NULL DEFAULT false;

-- Create GemTransactionType enum
CREATE TYPE "GemTransactionType" AS ENUM ('purchase', 'reading_spend', 'rating_bonus', 'free_reading');

-- Create gem_transactions table
CREATE TABLE "gem_transactions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "GemTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gem_transactions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for gem_transactions
ALTER TABLE "gem_transactions" ADD CONSTRAINT "gem_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add isFreeReading to submissions
ALTER TABLE "submissions" ADD COLUMN "isFreeReading" BOOLEAN NOT NULL DEFAULT false;

-- Add ratingBonusClaimed to feedbacks
ALTER TABLE "feedbacks" ADD COLUMN "ratingBonusClaimed" BOOLEAN NOT NULL DEFAULT false;
