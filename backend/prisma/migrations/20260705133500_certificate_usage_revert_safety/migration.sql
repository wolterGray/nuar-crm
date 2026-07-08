ALTER TABLE "CertificateUsage"
ADD COLUMN "revertedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CertificateUsage_certificateId_visitId_key"
ON "CertificateUsage"("certificateId", "visitId");
