CREATE TABLE "NotificationRecipient" (
  "id" SERIAL NOT NULL,
  "notificationEventId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "snoozedUntil" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "actionHistory" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationRecipient_notificationEventId_userId_key"
  ON "NotificationRecipient"("notificationEventId", "userId");
CREATE INDEX "NotificationRecipient_userId_status_snoozedUntil_idx"
  ON "NotificationRecipient"("userId", "status", "snoozedUntil");
CREATE INDEX "NotificationRecipient_notificationEventId_idx"
  ON "NotificationRecipient"("notificationEventId");
ALTER TABLE "NotificationRecipient"
  ADD CONSTRAINT "NotificationRecipient_notificationEventId_fkey"
  FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient"
  ADD CONSTRAINT "NotificationRecipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
