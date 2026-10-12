-- CreateEnum
CREATE TYPE "SofaStatus" AS ENUM ('KOSONG', 'TERISI', 'MENUNGGU_MAKANAN', 'SIAP_BAYAR');

-- CreateEnum
CREATE TYPE "MenuKategori" AS ENUM ('MAKANAN', 'MINUMAN');

-- CreateEnum
CREATE TYPE "BillTipe" AS ENUM ('DINE_IN', 'TAKE_AWAY', 'RESERVATION');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('TERBUKA', 'LUNAS', 'BATAL');

-- CreateEnum
CREATE TYPE "BillItemStatus" AS ENUM ('DIKIRIM', 'DIPROSES', 'SIAP');

-- CreateEnum
CREATE TYPE "ReservasiStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Peran" AS ENUM ('PELAYAN', 'BARTENDER', 'DAPUR', 'KASIR', 'MANAJER');

-- CreateTable
CREATE TABLE "Sofa" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kapasitas" INTEGER NOT NULL,
    "status" "SofaStatus" NOT NULL DEFAULT 'KOSONG',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Sofa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "harga" INTEGER NOT NULL,
    "kategori" "MenuKategori" NOT NULL,
    "tersedia" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "nomorBill" INTEGER,
    "tipe" "BillTipe" NOT NULL,
    "sofaId" TEXT,
    "waktuBuka" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktuTutup" TIMESTAMP(3),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "diskon" INTEGER NOT NULL DEFAULT 0,
    "pajak" INTEGER NOT NULL DEFAULT 0,
    "pajakPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "service" INTEGER NOT NULL DEFAULT 0,
    "servicePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pembulatanRatusan" BOOLEAN NOT NULL DEFAULT false,
    "pembulatan" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "metodeBayar" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'TERBUKA',
    "kasirId" TEXT,
    "shiftId" TEXT,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "namaItem" TEXT NOT NULL,
    "harga" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "catatan" TEXT,
    "status" "BillItemStatus" NOT NULL DEFAULT 'DIKIRIM',
    "diretur" BOOLEAN NOT NULL DEFAULT false,
    "isVoid" BOOLEAN NOT NULL DEFAULT false,
    "isComp" BOOLEAN NOT NULL DEFAULT false,
    "otorisasiOleh" TEXT,
    "alasanVoidComp" TEXT,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservasi" (
    "id" TEXT NOT NULL,
    "sofaId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jam" TIMESTAMP(3) NOT NULL,
    "jumlahOrang" INTEGER NOT NULL,
    "deposit" INTEGER,
    "status" "ReservasiStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Reservasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "kasirId" TEXT NOT NULL,
    "waktuBuka" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktuTutup" TIMESTAMP(3),
    "kasAwal" INTEGER NOT NULL,
    "kasAkhir" INTEGER,
    "pengeluaran" INTEGER NOT NULL DEFAULT 0,
    "catatanPengeluaran" TEXT,
    "totalPenjualan" INTEGER,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "peran" "Peran" NOT NULL,
    "pin" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "kunci" TEXT NOT NULL,
    "nilai" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bill_sofaId_status_idx" ON "Bill"("sofaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_kunci_key" ON "Setting"("kunci");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_sofaId_fkey" FOREIGN KEY ("sofaId") REFERENCES "Sofa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_kasirId_fkey" FOREIGN KEY ("kasirId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservasi" ADD CONSTRAINT "Reservasi_sofaId_fkey" FOREIGN KEY ("sofaId") REFERENCES "Sofa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_kasirId_fkey" FOREIGN KEY ("kasirId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
