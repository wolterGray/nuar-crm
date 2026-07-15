ALTER TABLE "LoyaltyCard" ADD COLUMN "publicCode" TEXT;

CREATE OR REPLACE FUNCTION generate_loyalty_public_code()
RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

DO $$
DECLARE
  card RECORD;
  next_code TEXT;
BEGIN
  FOR card IN SELECT id FROM "LoyaltyCard" WHERE "publicCode" IS NULL LOOP
    LOOP
      next_code := generate_loyalty_public_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "LoyaltyCard" WHERE "publicCode" = next_code
      );
    END LOOP;

    UPDATE "LoyaltyCard"
    SET "publicCode" = next_code
    WHERE id = card.id;
  END LOOP;
END $$;

DROP FUNCTION generate_loyalty_public_code();

ALTER TABLE "LoyaltyCard" ALTER COLUMN "publicCode" SET NOT NULL;

CREATE UNIQUE INDEX "LoyaltyCard_publicCode_key" ON "LoyaltyCard"("publicCode");
