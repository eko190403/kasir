ALTER TABLE "Bill"
  ALTER COLUMN "pajakPct" TYPE DOUBLE PRECISION
  USING "pajakPct"::DOUBLE PRECISION,
  ALTER COLUMN "servicePct" TYPE DOUBLE PRECISION
  USING "servicePct"::DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pembulatanRatusan" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "pembulatan" INTEGER NOT NULL DEFAULT 0;

WITH current_settings AS (
  SELECT
    COALESCE(
      MAX(CASE
        WHEN "kunci" = 'PAJAK'
          AND "nilai" ~ '^[0-9]+([.][0-9]+)?$'
          AND "nilai"::DOUBLE PRECISION BETWEEN 0 AND 100
        THEN "nilai"::DOUBLE PRECISION
      END),
      10
    ) AS pajak_pct,
    COALESCE(
      MAX(CASE
        WHEN "kunci" = 'SERVICE_CHARGE'
          AND "nilai" ~ '^[0-9]+([.][0-9]+)?$'
          AND "nilai"::DOUBLE PRECISION BETWEEN 0 AND 100
        THEN "nilai"::DOUBLE PRECISION
      END),
      5
    ) AS service_pct,
    COALESCE(MAX(CASE
      WHEN "kunci" = 'PEMBULATAN_RATUSAN' AND "nilai" = 'true' THEN 1
      ELSE 0
    END), 0) = 1 AS pembulatan_ratusan
  FROM "Setting"
)
UPDATE "Bill" AS bill
SET
  "pajakPct" = CASE
    WHEN bill."status" = 'TERBUKA' AND bill."pajakPct" = 0 AND bill."servicePct" = 0 THEN settings.pajak_pct
    ELSE bill."pajakPct"
  END,
  "servicePct" = CASE
    WHEN bill."status" = 'TERBUKA' AND bill."pajakPct" = 0 AND bill."servicePct" = 0 THEN settings.service_pct
    ELSE bill."servicePct"
  END,
  "pembulatan" = bill."total" - (bill."subtotal" - bill."diskon" + bill."service" + bill."pajak"),
  "pembulatanRatusan" = CASE
    WHEN bill."status" = 'TERBUKA' THEN settings.pembulatan_ratusan
    ELSE bill."total" - (bill."subtotal" - bill."diskon" + bill."service" + bill."pajak") <> 0
  END
FROM current_settings AS settings;
