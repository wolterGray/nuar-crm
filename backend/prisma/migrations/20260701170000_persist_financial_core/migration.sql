CREATE TABLE "Package" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "service" TEXT,
  "visitsCount" INTEGER,
  "price" DECIMAL(65,30),
  "validityDays" INTEGER,
  "status" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPackage" (
  "id" SERIAL NOT NULL,
  "clientId" INTEGER,
  "packageId" INTEGER,
  "employeeId" INTEGER,
  "clientName" TEXT,
  "packageName" TEXT,
  "service" TEXT,
  "totalVisits" INTEGER,
  "remainingVisits" INTEGER,
  "price" DECIMAL(65,30),
  "purchaseDate" TEXT,
  "expiryDate" TEXT,
  "payment" TEXT,
  "status" TEXT,
  "writeOffHistory" JSONB,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientPackageUsage" (
  "id" SERIAL NOT NULL,
  "clientPackageId" INTEGER NOT NULL,
  "visitId" INTEGER,
  "sessionsUsed" INTEGER NOT NULL DEFAULT 1,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientPackageUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Certificate" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "clientId" INTEGER,
  "recipientId" INTEGER,
  "employeeId" INTEGER,
  "saleVisitId" INTEGER,
  "clientName" TEXT,
  "recipientName" TEXT,
  "nominal" DECIMAL(65,30),
  "remainingBalance" DECIMAL(65,30),
  "purchaseDate" TEXT,
  "usedDate" TEXT,
  "expiryDate" TEXT,
  "payment" TEXT,
  "status" TEXT,
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CertificateUsage" (
  "id" SERIAL NOT NULL,
  "certificateId" INTEGER NOT NULL,
  "visitId" INTEGER,
  "amount" DECIMAL(65,30),
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CertificateUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DayCloseRecord" (
  "id" SERIAL NOT NULL,
  "date" TEXT NOT NULL,
  "cash" DECIMAL(65,30),
  "card" DECIMAL(65,30),
  "blik" DECIMAL(65,30),
  "certificates" DECIMAL(65,30),
  "packages" DECIMAL(65,30),
  "total" DECIMAL(65,30),
  "status" TEXT,
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DayCloseRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollRecord" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER,
  "employeeName" TEXT,
  "startDate" TEXT,
  "endDate" TEXT,
  "periodKey" TEXT NOT NULL,
  "amount" DECIMAL(65,30),
  "status" TEXT,
  "paidAt" TIMESTAMP(3),
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");
CREATE UNIQUE INDEX "DayCloseRecord_date_key" ON "DayCloseRecord"("date");
CREATE UNIQUE INDEX "PayrollRecord_periodKey_key" ON "PayrollRecord"("periodKey");

ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPackage" ADD CONSTRAINT "ClientPackage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientPackageUsage" ADD CONSTRAINT "ClientPackageUsage_clientPackageId_fkey" FOREIGN KEY ("clientPackageId") REFERENCES "ClientPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientPackageUsage" ADD CONSTRAINT "ClientPackageUsage_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CertificateUsage" ADD CONSTRAINT "CertificateUsage_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CertificateUsage" ADD CONSTRAINT "CertificateUsage_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
