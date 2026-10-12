ALTER TABLE "Reservasi"
  ADD COLUMN "depositMetode" "MetodeBayar",
  ADD COLUMN "billId" TEXT;

CREATE UNIQUE INDEX "Reservasi_billId_key" ON "Reservasi"("billId");

ALTER TABLE "Reservasi"
  ADD CONSTRAINT "Reservasi_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Bill"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
