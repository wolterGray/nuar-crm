-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "employeeId" INTEGER,
  ADD COLUMN "permissions" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- AddForeignKey
ALTER TABLE "User"
  ADD CONSTRAINT "User_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
