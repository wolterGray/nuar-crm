CREATE TABLE "NotificationEvent" (
  "id" SERIAL NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "clientId" INTEGER,
  "clientName" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "score" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "snoozedUntil" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "payload" JSONB,
  "actionHistory" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationDelivery"
ADD COLUMN "notificationEventId" INTEGER;

CREATE UNIQUE INDEX "NotificationEvent_fingerprint_key" ON "NotificationEvent"("fingerprint");
CREATE INDEX "NotificationEvent_status_priority_score_idx" ON "NotificationEvent"("status", "priority", "score");
CREATE INDEX "NotificationEvent_type_status_idx" ON "NotificationEvent"("type", "status");
CREATE INDEX "NotificationEvent_clientId_idx" ON "NotificationEvent"("clientId");
CREATE INDEX "NotificationEvent_snoozedUntil_idx" ON "NotificationEvent"("snoozedUntil");
CREATE INDEX "NotificationEvent_createdAt_idx" ON "NotificationEvent"("createdAt");
CREATE INDEX "NotificationDelivery_notificationEventId_idx" ON "NotificationDelivery"("notificationEventId");

ALTER TABLE "NotificationEvent"
ADD CONSTRAINT "NotificationEvent_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationEventId_fkey"
FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
