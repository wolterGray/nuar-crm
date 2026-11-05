ALTER TABLE "AuthSession" ADD COLUMN "deviceId" TEXT;

CREATE UNIQUE INDEX "AuthSession_userId_deviceId_key"
ON "AuthSession"("userId", "deviceId");
