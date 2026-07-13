ALTER TABLE "LoyaltyCard" ADD COLUMN "publicToken" TEXT;

CREATE UNIQUE INDEX "LoyaltyCard_publicToken_key" ON "LoyaltyCard"("publicToken");
