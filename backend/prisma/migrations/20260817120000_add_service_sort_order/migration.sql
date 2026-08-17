ALTER TABLE "Service"
  ADD COLUMN "sortOrder" INTEGER;

UPDATE "Service"
SET "sortOrder" = ordered.row_number - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC, id ASC) AS row_number
  FROM "Service"
) AS ordered
WHERE "Service".id = ordered.id
  AND "Service"."sortOrder" IS NULL;
