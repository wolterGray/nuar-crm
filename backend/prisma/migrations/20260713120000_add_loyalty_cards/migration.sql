-- CreateEnum
CREATE TYPE "LoyaltyTransactionType" AS ENUM ('EARN', 'REDEEM', 'CORRECTION', 'REVERSAL');

-- CreateTable
CREATE TABLE "LoyaltyCard" (
    "id" SERIAL NOT NULL,
    "clientId" INTEGER NOT NULL,
    "publicTokenHash" TEXT NOT NULL,
    "stamps" INTEGER NOT NULL DEFAULT 0,
    "targetStamps" INTEGER NOT NULL DEFAULT 5,
    "rewardAvailable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoyaltyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" SERIAL NOT NULL,
    "loyaltyCardId" INTEGER NOT NULL,
    "appointmentId" INTEGER,
    "type" "LoyaltyTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_clientId_key" ON "LoyaltyCard"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyCard_publicTokenHash_key" ON "LoyaltyCard"("publicTokenHash");

-- CreateIndex
CREATE INDEX "LoyaltyCard_isActive_idx" ON "LoyaltyCard"("isActive");

-- CreateIndex
CREATE INDEX "LoyaltyCard_updatedAt_idx" ON "LoyaltyCard"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyTransaction_appointmentId_type_key" ON "LoyaltyTransaction"("appointmentId", "type");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_loyaltyCardId_createdAt_idx" ON "LoyaltyTransaction"("loyaltyCardId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_appointmentId_idx" ON "LoyaltyTransaction"("appointmentId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_type_idx" ON "LoyaltyTransaction"("type");

-- AddForeignKey
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_loyaltyCardId_fkey" FOREIGN KEY ("loyaltyCardId") REFERENCES "LoyaltyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
