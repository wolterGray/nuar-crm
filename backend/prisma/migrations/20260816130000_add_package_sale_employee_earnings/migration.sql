-- Add package-sale earning snapshots to EmployeeEarning.
-- This migration is additive for existing data: existing visit earnings stay linked by visitId.

ALTER TABLE "EmployeeEarning"
ADD COLUMN "clientPackageId" INTEGER,
ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'VISIT';

ALTER TABLE "EmployeeEarning"
ALTER COLUMN "visitId" DROP NOT NULL;

CREATE UNIQUE INDEX "EmployeeEarning_clientPackageId_key"
ON "EmployeeEarning"("clientPackageId");

ALTER TABLE "EmployeeEarning"
ADD CONSTRAINT "EmployeeEarning_clientPackageId_fkey"
FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
