DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Visit"
    WHERE "calendarEntryId" IS NOT NULL
    GROUP BY "calendarEntryId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce Visit.calendarEntryId uniqueness: duplicate completed visits exist. Run the CRM dedupe-calendar maintenance action first.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "CalendarEntry"
    WHERE "visitId" IS NOT NULL
    GROUP BY "visitId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce CalendarEntry.visitId uniqueness: one visit is linked to multiple calendar entries.';
  END IF;
END $$;

CREATE UNIQUE INDEX "Visit_calendarEntryId_key" ON "Visit"("calendarEntryId");
CREATE UNIQUE INDEX "CalendarEntry_visitId_key" ON "CalendarEntry"("visitId");
