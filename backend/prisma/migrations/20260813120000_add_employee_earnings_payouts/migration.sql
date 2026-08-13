-- Add per-visit employee earning snapshots and payout history.
-- This migration is additive: it creates new tables and indexes only.

CREATE TABLE "EmployeePayout" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "note" TEXT,
    "cancellationNote" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeEarning" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "visitId" INTEGER NOT NULL,
    "actualPrice" DECIMAL(65,30) NOT NULL,
    "commissionPercent" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "payoutId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEarning_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeEarning_visitId_key" ON "EmployeeEarning"("visitId");
CREATE INDEX "EmployeeEarning_employeeId_createdAt_idx" ON "EmployeeEarning"("employeeId", "createdAt");
CREATE INDEX "EmployeeEarning_payoutId_idx" ON "EmployeeEarning"("payoutId");
CREATE INDEX "EmployeePayout_employeeId_paidAt_idx" ON "EmployeePayout"("employeeId", "paidAt");
CREATE INDEX "EmployeePayout_status_idx" ON "EmployeePayout"("status");

ALTER TABLE "EmployeePayout"
ADD CONSTRAINT "EmployeePayout_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeEarning"
ADD CONSTRAINT "EmployeeEarning_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeEarning"
ADD CONSTRAINT "EmployeeEarning_visitId_fkey"
FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeEarning"
ADD CONSTRAINT "EmployeeEarning_payoutId_fkey"
FOREIGN KEY ("payoutId") REFERENCES "EmployeePayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
