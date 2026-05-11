-- Adds models + fields that were introduced during design-system migration:
--   • User.preferred_lang   (localized notifications / email)
--   • assignment_resources  (teacher-attached files on assignments)
--   • assignment_comments   (per-assignment discussion thread)
--   • submission_attachments(multi-file student submissions)

-- ── User.preferredLang ──────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_lang" TEXT;

-- ── AssignmentResource ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assignment_resources" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignment_resources_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assignment_resources_assignment_id_idx"
    ON "assignment_resources"("assignment_id");

ALTER TABLE "assignment_resources"
    ADD CONSTRAINT "assignment_resources_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── AssignmentComment ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "assignment_comments" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignment_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "assignment_comments_assignment_id_idx"
    ON "assignment_comments"("assignment_id");
CREATE INDEX IF NOT EXISTS "assignment_comments_author_id_idx"
    ON "assignment_comments"("author_id");

ALTER TABLE "assignment_comments"
    ADD CONSTRAINT "assignment_comments_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assignment_comments"
    ADD CONSTRAINT "assignment_comments_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── SubmissionAttachment ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "submission_attachments" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "submission_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "submission_attachments_submission_id_idx"
    ON "submission_attachments"("submission_id");

ALTER TABLE "submission_attachments"
    ADD CONSTRAINT "submission_attachments_submission_id_fkey"
    FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
