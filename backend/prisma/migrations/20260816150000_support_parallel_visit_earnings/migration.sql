DROP INDEX IF EXISTS "EmployeeEarning_visitId_key";
CREATE INDEX IF NOT EXISTS "EmployeeEarning_visitId_idx" ON "EmployeeEarning"("visitId");
