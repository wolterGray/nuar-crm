ALTER TABLE "Visit" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "Visit" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "Visit" ALTER COLUMN "scheduledAt" DROP NOT NULL;

ALTER TABLE "Visit" ADD COLUMN "calendarEntryId" INTEGER;
ALTER TABLE "Visit" ADD COLUMN "recordType" TEXT;
ALTER TABLE "Visit" ADD COLUMN "payload" JSONB;

CREATE TABLE "CalendarEntry" (
    "id" SERIAL NOT NULL,
    "kind" TEXT,
    "date" TEXT,
    "time" TEXT,
    "status" TEXT,
    "visitId" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id")
);
