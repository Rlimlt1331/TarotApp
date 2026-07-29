-- Add telegramNotifyMode to user_preferences
ALTER TABLE "user_preferences" ADD COLUMN "telegramNotifyMode" TEXT;

-- Migrate existing values from users.telegramNotifyMode into user_preferences (upsert)
INSERT INTO "user_preferences" ("userId", "telegramNotifyMode", "createdAt", "updatedAt")
SELECT id, "telegramNotifyMode", NOW(), NOW()
FROM "users"
WHERE "telegramNotifyMode" IS NOT NULL
ON CONFLICT ("userId") DO UPDATE
  SET "telegramNotifyMode" = EXCLUDED."telegramNotifyMode",
      "updatedAt" = NOW();

-- Drop telegramNotifyMode from users
ALTER TABLE "users" DROP COLUMN "telegramNotifyMode";
