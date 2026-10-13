CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "shiftId" TEXT,
    "operatorId" TEXT NOT NULL,
    "metode" "MetodeBayar" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL,
    "referensi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Refund_billId_key" ON "Refund"("billId");
CREATE INDEX "Refund_shiftId_createdAt_idx" ON "Refund"("shiftId", "createdAt");
CREATE INDEX "Refund_createdAt_idx" ON "Refund"("createdAt");

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_billId_fkey"
    FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_operatorId_fkey"
    FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
