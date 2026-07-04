CREATE TABLE "AuditLog" (
  "id" SERIAL NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErrorEvent" (
  "id" SERIAL NOT NULL,
  "source" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "stack" TEXT,
  "context" JSONB,
  "severity" TEXT NOT NULL DEFAULT 'error',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" SERIAL NOT NULL,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "templateKey" TEXT,
  "messageText" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "providerMessageId" TEXT,
  "errorMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationJob" (
  "id" SERIAL NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntegrationJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

CREATE INDEX "ErrorEvent_createdAt_idx" ON "ErrorEvent"("createdAt");
CREATE INDEX "ErrorEvent_source_idx" ON "ErrorEvent"("source");
CREATE INDEX "ErrorEvent_severity_idx" ON "ErrorEvent"("severity");

CREATE INDEX "NotificationDelivery_status_scheduledAt_idx" ON "NotificationDelivery"("status", "scheduledAt");
CREATE INDEX "NotificationDelivery_channel_idx" ON "NotificationDelivery"("channel");
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

CREATE INDEX "IntegrationJob_type_status_idx" ON "IntegrationJob"("type", "status");
CREATE INDEX "IntegrationJob_createdAt_idx" ON "IntegrationJob"("createdAt");
