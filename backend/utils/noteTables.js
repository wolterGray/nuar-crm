let ensurePromise;

const createNoteTables = async (prisma) => {
  await prisma.$executeRawUnsafe(`
    create table if not exists note_revisions (
      id bigserial primary key,
      note_id integer not null references "Task"(id) on delete cascade,
      title text not null,
      content text,
      priority text,
      payload jsonb,
      version integer not null default 0,
      created_at timestamptz not null default now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists note_revisions_note_id_created_at_idx
    on note_revisions(note_id, created_at desc)
  `);
  await prisma.$executeRawUnsafe(`
    create table if not exists note_attachments (
      id text primary key,
      note_id integer not null references "Task"(id) on delete cascade,
      file_name text not null,
      mime_type text not null,
      size_bytes integer not null,
      data bytea not null,
      created_at timestamptz not null default now()
    )
  `);
  await prisma.$executeRawUnsafe(`
    create index if not exists note_attachments_note_id_created_at_idx
    on note_attachments(note_id, created_at asc)
  `);
};

const ensureNoteTables = async (prisma) => {
  if (!ensurePromise) {
    ensurePromise = createNoteTables(prisma).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

module.exports = {ensureNoteTables};
