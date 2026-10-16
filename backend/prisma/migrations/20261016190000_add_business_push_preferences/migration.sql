ALTER TABLE "User"
  ADD COLUMN "pushNewVisits" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushVisitCancelled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushVisitRescheduled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushImportantTasks" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pushOverdueTasks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "NotificationDelivery"
  ADD COLUMN "deduplicationKey" TEXT;

CREATE UNIQUE INDEX "NotificationDelivery_deduplicationKey_key"
  ON "NotificationDelivery"("deduplicationKey");
