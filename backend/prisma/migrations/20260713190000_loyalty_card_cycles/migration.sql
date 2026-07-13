ALTER TABLE "LoyaltyCard" ADD COLUMN "lifetimeVisits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoyaltyCard" ADD COLUMN "cycleNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LoyaltyCard" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "LoyaltyCard" ADD COLUMN "archiveReason" TEXT;

UPDATE "LoyaltyCard"
SET
  "targetStamps" = 6,
  "lifetimeVisits" = GREATEST("stamps", 0)
WHERE "targetStamps" = 5;

DROP INDEX IF EXISTS "LoyaltyCard_clientId_key";

CREATE INDEX "LoyaltyCard_clientId_isActive_idx" ON "LoyaltyCard"("clientId", "isActive");
CREATE UNIQUE INDEX "LoyaltyCard_clientId_active_key" ON "LoyaltyCard"("clientId") WHERE "isActive" = true;
