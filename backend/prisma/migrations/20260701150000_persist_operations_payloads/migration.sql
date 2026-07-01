ALTER TABLE "Task"
  ADD COLUMN "type" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "priority" TEXT,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "sortOrder" INTEGER,
  ADD COLUMN "payload" JSONB;

CREATE TABLE "WaitlistEntry" (
  "id" SERIAL NOT NULL,
  "clientId" INTEGER,
  "clientName" TEXT,
  "preferredDate" TEXT,
  "preferredMaster" TEXT,
  "preferredService" TEXT,
  "preferredTimeFrom" TEXT,
  "preferredTimeTo" TEXT,
  "status" TEXT,
  "note" TEXT,
  "lastOfferedAt" TIMESTAMP(3),
  "lastOfferedSlot" JSONB,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supply" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "stock" DECIMAL(65,30),
  "minStock" DECIMAL(65,30),
  "unit" TEXT,
  "cost" DECIMAL(65,30),
  "note" TEXT,
  "orderUrl" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);
