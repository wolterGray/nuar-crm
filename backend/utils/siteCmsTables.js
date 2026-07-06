const ensureSiteCmsTables = async (prisma) => {
  await prisma.$executeRaw`
    create table if not exists site_content (
      id text primary key,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `;

  await prisma.$executeRaw`
    create table if not exists site_images (
      id text primary key,
      folder text not null default 'uploads',
      mime_type text not null,
      data_base64 text not null,
      size_bytes integer,
      thumb_mime_type text,
      thumb_base64 text,
      thumb_size_bytes integer,
      updated_at timestamptz not null default now()
    )
  `;
};

const ensureSiteBookingTables = async (prisma) => {
  await prisma.$executeRaw`
    create table if not exists site_booking_requests (
      id text primary key,
      client_name text not null,
      client_phone text not null,
      client_email text,
      service_slug text,
      service_name text not null,
      preferred_date text not null,
      preferred_time text not null,
      preferred_master text,
      duration_minutes integer not null default 60,
      status text not null default 'pending',
      note text,
      locale text,
      linked_calendar_entry_id text,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await prisma.$executeRaw`
    create index if not exists site_booking_requests_status_created_at_idx
    on site_booking_requests (status, created_at desc)
  `;
};

module.exports = {
  ensureSiteCmsTables,
  ensureSiteBookingTables,
};
