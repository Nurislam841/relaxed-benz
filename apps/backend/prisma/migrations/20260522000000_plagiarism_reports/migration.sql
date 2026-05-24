-- Plagiarism detection: cached pairwise similarity between submissions of the same assignment.
-- Algorithm v1: Jaccard similarity on word 3-grams of normalized contentText.

CREATE TABLE IF NOT EXISTS "plagiarism_reports" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "submission_a_id" TEXT NOT NULL,
    "submission_b_id" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "matched_ngrams" INTEGER NOT NULL DEFAULT 0,
    "method_version" TEXT NOT NULL DEFAULT 'jaccard-3gram-v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plagiarism_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plagiarism_reports_pair_method_key"
    ON "plagiarism_reports"("submission_a_id", "submission_b_id", "method_version");

CREATE INDEX IF NOT EXISTS "plagiarism_reports_assignment_id_idx"
    ON "plagiarism_reports"("assignment_id");

CREATE INDEX IF NOT EXISTS "plagiarism_reports_submission_a_id_idx"
    ON "plagiarism_reports"("submission_a_id");

CREATE INDEX IF NOT EXISTS "plagiarism_reports_submission_b_id_idx"
    ON "plagiarism_reports"("submission_b_id");

ALTER TABLE "plagiarism_reports"
    ADD CONSTRAINT "plagiarism_reports_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plagiarism_reports"
    ADD CONSTRAINT "plagiarism_reports_submission_a_id_fkey"
    FOREIGN KEY ("submission_a_id") REFERENCES "submissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plagiarism_reports"
    ADD CONSTRAINT "plagiarism_reports_submission_b_id_fkey"
    FOREIGN KEY ("submission_b_id") REFERENCES "submissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
