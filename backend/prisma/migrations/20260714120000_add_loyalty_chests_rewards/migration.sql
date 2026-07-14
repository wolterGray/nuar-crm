-- NUAR Club chests and rewards.
CREATE TABLE "LoyaltyRewardTemplate" (
  "id" SERIAL NOT NULL,
  "tier" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rewardType" TEXT,
  "durationMin" INTEGER,
  "value" DECIMAL(65,30),
  "weight" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "requiresOwnerApproval" BOOLEAN NOT NULL DEFAULT false,
  "expiresAfterDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyRewardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyChest" (
  "id" SERIAL NOT NULL,
  "clientId" INTEGER NOT NULL,
  "loyaltyCardId" INTEGER,
  "tier" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available',
  "visitNumber" INTEGER,
  "openedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyChest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyReward" (
  "id" SERIAL NOT NULL,
  "clientId" INTEGER NOT NULL,
  "templateId" INTEGER,
  "sourceChestId" INTEGER,
  "snapshotTier" TEXT NOT NULL,
  "snapshotName" TEXT NOT NULL,
  "snapshotDescription" TEXT,
  "snapshotType" TEXT,
  "snapshotDurationMin" INTEGER,
  "snapshotValue" DECIMAL(65,30),
  "requiresOwnerApproval" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'available',
  "expiresAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "redeemedById" INTEGER,
  "visitId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyRewardTemplate_tier_active_idx" ON "LoyaltyRewardTemplate"("tier", "active");
CREATE INDEX "LoyaltyRewardTemplate_updatedAt_idx" ON "LoyaltyRewardTemplate"("updatedAt");

CREATE UNIQUE INDEX "LoyaltyChest_loyaltyCardId_visitNumber_key" ON "LoyaltyChest"("loyaltyCardId", "visitNumber");
CREATE INDEX "LoyaltyChest_clientId_status_idx" ON "LoyaltyChest"("clientId", "status");
CREATE INDEX "LoyaltyChest_tier_status_idx" ON "LoyaltyChest"("tier", "status");
CREATE INDEX "LoyaltyChest_createdAt_idx" ON "LoyaltyChest"("createdAt");

CREATE UNIQUE INDEX "LoyaltyReward_sourceChestId_key" ON "LoyaltyReward"("sourceChestId");
CREATE INDEX "LoyaltyReward_clientId_status_idx" ON "LoyaltyReward"("clientId", "status");
CREATE INDEX "LoyaltyReward_templateId_idx" ON "LoyaltyReward"("templateId");
CREATE INDEX "LoyaltyReward_snapshotTier_status_idx" ON "LoyaltyReward"("snapshotTier", "status");
CREATE INDEX "LoyaltyReward_expiresAt_idx" ON "LoyaltyReward"("expiresAt");

ALTER TABLE "LoyaltyChest"
  ADD CONSTRAINT "LoyaltyChest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyChest"
  ADD CONSTRAINT "LoyaltyChest_loyaltyCardId_fkey"
  FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyReward"
  ADD CONSTRAINT "LoyaltyReward_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoyaltyReward"
  ADD CONSTRAINT "LoyaltyReward_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "LoyaltyRewardTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyReward"
  ADD CONSTRAINT "LoyaltyReward_sourceChestId_fkey"
  FOREIGN KEY ("sourceChestId") REFERENCES "LoyaltyChest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyReward"
  ADD CONSTRAINT "LoyaltyReward_redeemedById_fkey"
  FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LoyaltyReward"
  ADD CONSTRAINT "LoyaltyReward_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
