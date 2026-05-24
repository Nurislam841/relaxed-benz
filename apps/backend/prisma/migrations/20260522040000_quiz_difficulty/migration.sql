-- Adaptive quiz difficulty: tag each question with an EASY/MEDIUM/HARD level.
-- The adaptive flow uses this to step difficulty up after a streak of correct
-- answers and back down after misses, dynamically choosing the next question.

DO $$ BEGIN
  CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quiz_questions"
  ADD COLUMN IF NOT EXISTS "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM';

-- Composite index for "pick next unused question at this difficulty"
CREATE INDEX IF NOT EXISTS "quiz_questions_quiz_id_difficulty_idx"
  ON "quiz_questions" ("quiz_id", "difficulty");
