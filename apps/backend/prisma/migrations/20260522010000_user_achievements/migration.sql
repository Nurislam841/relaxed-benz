-- Gamification: per-user achievement grants.
-- Definitions (icon/name/criteria) live in code (achievements.catalog.ts),
-- only the unlock events are persisted here for fast querying.

CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "achievement_key" TEXT NOT NULL,
    "metadata" JSONB,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_user_id_achievement_key_key"
    ON "user_achievements"("user_id", "achievement_key");

CREATE INDEX IF NOT EXISTS "user_achievements_user_id_idx"
    ON "user_achievements"("user_id");

ALTER TABLE "user_achievements"
    ADD CONSTRAINT "user_achievements_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
