-- Phase B: add two-signal verification columns to claims
-- Entailment label + score come from the independent NLI check.
-- Confidence is the calibrated blend of all four signals.
-- The constraint enforces the two-signal rule at the DB level:
--   a claim can only be supported=true when the NLI model agreed (entail).

ALTER TABLE claims
    ADD COLUMN IF NOT EXISTS entailment_label text
        CHECK (entailment_label IN ('entail', 'neutral', 'contradict')),
    ADD COLUMN IF NOT EXISTS entailment_score numeric(3,2)
        CHECK (entailment_score BETWEEN 0 AND 1),
    ADD COLUMN IF NOT EXISTS confidence numeric(3,2)
        CHECK (confidence BETWEEN 0 AND 1);

-- Enforces the two-signal rule: supported=true requires entailment_label='entail'.
-- Added as a separate statement so it can be applied to existing rows safely.
-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so guard with a DO block.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'claims_supported_requires_entailment'
    ) THEN
        ALTER TABLE claims
            ADD CONSTRAINT claims_supported_requires_entailment
                CHECK (supported = false OR entailment_label = 'entail');
    END IF;
END $$;

-- Confirm debate_turns table exists (created in 001_initial_schema.sql).
-- This is a guard, not a creation: the migration fails fast if it was missed.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'debate_turns'
    ) THEN
        RAISE EXCEPTION 'debate_turns table missing — re-apply 001_initial_schema.sql';
    END IF;
END $$;
