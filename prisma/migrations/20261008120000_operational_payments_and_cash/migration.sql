-- Preserve the existing JSON-encoded audit details while converting the column.
ALTER TABLE "AuditLog"
  ALTER COLUMN "detail" TYPE JSONB
  USING "detail"::JSONB;

ALTER TABLE "Bill"
  ADD COLUMN "businessDate" DATE,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3);

ALTER TABLE "Bill"
  ADD COLUMN "kembalian" INTEGER,
  ADD COLUMN "uangDiterima" INTEGER;

-- Business dates roll over at 06:00 in Jakarta time.
UPDATE "Bill"
SET "businessDate" = (
  (("waktuBuka" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta') - INTERVAL '6 hours'
)::DATE,
"updatedAt" = "waktuBuka";

WITH numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "businessDate"
      ORDER BY "waktuBuka", "id"
    )::INTEGER AS next_number
  FROM "Bill"
)
UPDATE "Bill" AS bill
SET "nomorBill" = numbered.next_number
FROM numbered
WHERE bill."id" = numbered."id";

ALTER TABLE "Bill"
  ALTER COLUMN "businessDate" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "nomorBill" SET NOT NULL;

ALTER TABLE "BillItem"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "hargaAsli" INTEGER,
  ADD COLUMN "isHappyHour" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Reservasi"
  ADD COLUMN "noHp" TEXT;

ALTER TABLE "Shift"
  ADD COLUMN "kasHitung" INTEGER,
  ADD COLUMN "selisih" INTEGER;

CREATE TYPE "MetodeBayar" AS ENUM ('TUNAI', 'KARTU', 'QRIS');

CREATE TABLE "BillCounter" (
  "businessDate" DATE NOT NULL,
  "last" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BillCounter_pkey" PRIMARY KEY ("businessDate")
);

INSERT INTO "BillCounter" ("businessDate", "last")
SELECT "businessDate", MAX("nomorBill")
FROM "Bill"
GROUP BY "businessDate";

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "metode" "MetodeBayar" NOT NULL,
  "jumlah" INTEGER NOT NULL,
  "referensi" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Backfill only legacy payment methods that are unambiguous. Old mixed-method
-- SPLIT transactions did not retain their allocations and are intentionally omitted.
INSERT INTO "Payment" ("id", "billId", "metode", "jumlah", "createdAt")
SELECT
  gen_random_uuid()::TEXT,
  bill."id",
  CASE
    WHEN UPPER(TRIM(bill."metodeBayar")) IN ('TUNAI', 'CASH', 'SPLIT (TUNAI)') THEN 'TUNAI'::"MetodeBayar"
    WHEN UPPER(TRIM(bill."metodeBayar")) IN ('KARTU', 'SPLIT (KARTU)') THEN 'KARTU'::"MetodeBayar"
    WHEN UPPER(TRIM(bill."metodeBayar")) IN ('QRIS', 'SPLIT (QRIS)') THEN 'QRIS'::"MetodeBayar"
  END,
  bill."total",
  COALESCE(bill."waktuTutup", bill."waktuBuka")
FROM "Bill" AS bill
WHERE bill."status" = 'LUNAS'
  AND bill."total" > 0
  AND UPPER(TRIM(bill."metodeBayar")) IN (
    'TUNAI', 'CASH', 'SPLIT (TUNAI)',
    'KARTU', 'SPLIT (KARTU)',
    'QRIS', 'SPLIT (QRIS)'
  );

-- Restore tender/change from the close-bill audit record when present.
WITH close_details AS (
  SELECT DISTINCT ON (log."detail"->>'billId')
    log."detail"->>'billId' AS bill_id,
    log."detail"->>'uangDiterima' AS uang_diterima,
    log."detail"->>'kembalian' AS kembalian
  FROM "AuditLog" AS log
  WHERE log."aksi" = 'CLOSE_BILL'
    AND log."detail"->>'billId' IS NOT NULL
  ORDER BY log."detail"->>'billId', log."waktu" DESC
)
UPDATE "Bill" AS bill
SET
  "uangDiterima" = CASE WHEN close_details.uang_diterima ~ '^[0-9]+$' THEN close_details.uang_diterima::INTEGER ELSE NULL END,
  "kembalian" = CASE WHEN close_details.kembalian ~ '^[0-9]+$' THEN close_details.kembalian::INTEGER ELSE NULL END
FROM close_details
WHERE bill."id" = close_details.bill_id;

DELETE FROM "Setting" WHERE "kunci" = 'PIN_MANAJER';

CREATE INDEX "Payment_billId_idx" ON "Payment"("billId");
CREATE INDEX "AuditLog_waktu_idx" ON "AuditLog"("waktu");
CREATE INDEX "Bill_status_waktuBuka_idx" ON "Bill"("status", "waktuBuka");
CREATE INDEX "Bill_shiftId_status_idx" ON "Bill"("shiftId", "status");
CREATE INDEX "Bill_waktuTutup_idx" ON "Bill"("waktuTutup");
CREATE UNIQUE INDEX "Bill_businessDate_nomorBill_key" ON "Bill"("businessDate", "nomorBill");
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");
CREATE INDEX "BillItem_status_idx" ON "BillItem"("status");
CREATE INDEX "Reservasi_sofaId_jam_idx" ON "Reservasi"("sofaId", "jam");
CREATE UNIQUE INDEX "one_open_shift_per_kasir"
  ON "Shift"("kasirId")
  WHERE "waktuTutup" IS NULL;
CREATE UNIQUE INDEX "one_open_bill_per_sofa"
  ON "Bill"("sofaId")
  WHERE "status" = 'TERBUKA' AND "sofaId" IS NOT NULL;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Bill"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
