CREATE TABLE IF NOT EXISTS "note_revisions" (
  "id" BIGSERIAL NOT NULL,
  "note_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "priority" TEXT,
  "payload" JSONB,
  "version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "note_attachments" (
  "id" TEXT NOT NULL,
  "note_id" INTEGER NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "note_revisions_note_id_created_at_idx"
  ON "note_revisions"("note_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "note_attachments_note_id_created_at_idx"
  ON "note_attachments"("note_id", "created_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_revisions_note_id_fkey') THEN
    ALTER TABLE "note_revisions"
      ADD CONSTRAINT "note_revisions_note_id_fkey"
      FOREIGN KEY ("note_id") REFERENCES "Task"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_attachments_note_id_fkey') THEN
    ALTER TABLE "note_attachments"
      ADD CONSTRAINT "note_attachments_note_id_fkey"
      FOREIGN KEY ("note_id") REFERENCES "Task"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
