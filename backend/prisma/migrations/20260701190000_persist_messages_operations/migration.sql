CREATE TABLE "MessageTemplate" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT,
  "language" TEXT,
  "audience" TEXT,
  "purpose" TEXT,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationLog" (
  "id" SERIAL NOT NULL,
  "clientId" INTEGER,
  "clientName" TEXT,
  "channel" TEXT,
  "templateName" TEXT,
  "body" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
