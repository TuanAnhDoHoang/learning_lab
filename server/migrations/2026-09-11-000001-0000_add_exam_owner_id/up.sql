ALTER TABLE exam ADD COLUMN IF NOT EXISTS owner_id INT;

UPDATE exam
SET owner_id = 1
WHERE owner_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'exam'
          AND column_name = 'owner_id'
    ) THEN
        ALTER TABLE exam
            ALTER COLUMN owner_id SET NOT NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'exam'::regclass
          AND conname = 'exam_owner_id_fkey'
    ) THEN
        ALTER TABLE exam
            ADD CONSTRAINT exam_owner_id_fkey
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
