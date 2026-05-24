-- Full-text search via PostgreSQL tsvector + GIN indexes.
--
-- Why "simple" dictionary instead of "english":
--   Our content is trilingual (en/ru/kz). The "english" dictionary stems and
--   discards stop-words that are meaningful in other languages. "simple" just
--   lowercases and tokenises, which gives the right behaviour across all
--   three languages with minimal complexity. Trade-off: no English stemming
--   ("running" won't match "run"). For a learning platform this is fine.
--
-- Why weighted columns (A/B/C):
--   Title/code matches should rank higher than description matches. The
--   ts_rank function in the service layer takes weights into account.

-- ─── courses ──────────────────────────────────────────────────────────────
ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("code", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("title", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "courses_search_vector_idx"
  ON "courses" USING GIN("search_vector");

-- ─── course_materials ─────────────────────────────────────────────────────
ALTER TABLE "course_materials"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("content", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "course_materials_search_vector_idx"
  ON "course_materials" USING GIN("search_vector");

-- ─── assignments ──────────────────────────────────────────────────────────
ALTER TABLE "assignments"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "assignments_search_vector_idx"
  ON "assignments" USING GIN("search_vector");

-- ─── announcements ────────────────────────────────────────────────────────
ALTER TABLE "announcements"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("body", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "announcements_search_vector_idx"
  ON "announcements" USING GIN("search_vector");

-- ─── users (admin-only search target) ─────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("full_name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("email", '')), 'A')
  ) STORED;

CREATE INDEX IF NOT EXISTS "users_search_vector_idx"
  ON "users" USING GIN("search_vector");
