ALTER TABLE "Bill"
  ADD COLUMN IF NOT EXISTS "businessDate" DATE;

UPDATE "Bill"
SET "businessDate" = (
  (("waktuBuka" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta' - INTERVAL '6 hours')::DATE
)
WHERE "businessDate" IS NULL;

ALTER TABLE "Bill"
  ALTER COLUMN "businessDate" SET NOT NULL;
