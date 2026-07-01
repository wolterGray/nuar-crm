CREATE TABLE "SystemState" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemState_key_key" ON "SystemState"("key");
