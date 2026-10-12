import "dotenv/config"
import { Prisma, PrismaClient } from "@prisma/client"
import { computeShiftCash, type BillPaymentSummary } from "../lib/shift-math"

const prisma = new PrismaClient()
const applyChanges = process.argv.includes("--apply")
const normalizeTestCash = process.argv.includes("--normalize-test-cash")

type LegacyBill = {
  id: string
  metodeBayar: string | null
  total: number
  waktuTutup: Date | null
  waktuBuka: Date
}

function resolveLegacyMethod(method: string | null) {
  const normalized = (method ?? "").trim().toUpperCase()
  const methods: Record<string, "TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER"> = {
    TUNAI: "TUNAI",
    CASH: "TUNAI",
    "SPLIT (TUNAI)": "TUNAI",
    KARTU: "KARTU",
    CARD: "KARTU",
    "SPLIT (KARTU)": "KARTU",
    QRIS: "QRIS",
    "SPLIT (QRIS)": "QRIS",
    DEBIT: "DEBIT",
    "SPLIT (DEBIT)": "DEBIT",
    TRANSFER: "TRANSFER",
    "SPLIT (TRANSFER)": "TRANSFER",
  }
  return methods[normalized] ?? null
}

async function main() {
  const report = await prisma.$transaction(async tx => {
    const closedBillsWithoutPayments = await tx.bill.findMany({
      where: {
        status: "LUNAS",
        total: { gt: 0 },
        payments: { none: {} },
      },
      select: {
        id: true,
        metodeBayar: true,
        total: true,
        waktuTutup: true,
        waktuBuka: true,
      },
    })

    const billsToBackfill = closedBillsWithoutPayments.flatMap((bill: LegacyBill) => {
      const metode = resolveLegacyMethod(bill.metodeBayar)
      return metode ? [{ bill, metode }] : []
    })
    const ambiguousBills = closedBillsWithoutPayments.length - billsToBackfill.length

    const pendingPaymentsForClosedBills = await tx.payment.findMany({
      where: { status: "PENDING", bill: { status: "LUNAS" } },
      select: {
        id: true,
        bill: { select: { waktuTutup: true, waktuBuka: true } },
      },
    })

    const closedShifts = await tx.shift.findMany({
      where: { waktuTutup: { not: null } },
      select: {
        id: true,
        kasAwal: true,
        pengeluaran: true,
        kasAkhir: true,
        kasHitung: true,
        totalPenjualan: true,
        selisih: true,
        bills: {
          where: { status: "LUNAS" },
          select: {
            total: true,
            metodeBayar: true,
            payments: {
              select: { metode: true, jumlah: true, status: true },
            },
          },
        },
      },
    })

    const shiftUpdates = closedShifts.map(shift => {
      const totals = computeShiftCash(
        shift.kasAwal,
        shift.pengeluaran,
        shift.bills as BillPaymentSummary[],
        shift.kasHitung
      )
      const targetCash = normalizeTestCash ? totals.expectedCash : shift.kasHitung
      return {
        id: shift.id,
        previousKasHitung: shift.kasHitung,
        previousKasAkhir: shift.kasAkhir,
        kasTunaiDiharapkan: totals.expectedCash,
        nextKasHitung: targetCash,
        totalPenjualan: totals.totalPenjualan,
        selisih: targetCash === null ? null : targetCash - totals.expectedCash,
        changed:
          shift.totalPenjualan !== totals.totalPenjualan ||
          (normalizeTestCash
            ? shift.kasHitung !== totals.expectedCash ||
              shift.kasAkhir !== totals.expectedCash ||
              shift.selisih !== 0
            : shift.kasHitung !== null && shift.selisih !== totals.selisih),
      }
    })

    if (applyChanges) {
      if (billsToBackfill.length > 0) {
        await tx.payment.createMany({
          data: billsToBackfill.map(({ bill, metode }) => ({
            billId: bill.id,
            metode,
            jumlah: bill.total,
            status: "SUDAH_BAYAR",
            confirmedAt: bill.waktuTutup ?? bill.waktuBuka,
            createdAt: bill.waktuTutup ?? bill.waktuBuka,
          })),
        })
      }

      for (const payment of pendingPaymentsForClosedBills) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUDAH_BAYAR",
            confirmedAt: payment.bill.waktuTutup ?? payment.bill.waktuBuka,
          },
        })
      }

      for (const shift of shiftUpdates) {
        await tx.shift.update({
          where: { id: shift.id },
          data: {
            totalPenjualan: shift.totalPenjualan,
            ...(normalizeTestCash
              ? {
                  kasHitung: shift.nextKasHitung,
                  kasAkhir: shift.nextKasHitung,
                  selisih: shift.selisih,
                }
              : shift.selisih !== null
                ? { selisih: shift.selisih }
                : {}),
          },
        })
      }
    }

    return {
      mode: applyChanges ? "APPLIED" : "DRY_RUN",
      safeBillsToBackfill: billsToBackfill.length,
      pendingPaymentsToConfirm: pendingPaymentsForClosedBills.length,
      closedShiftsToRecalculate: shiftUpdates.filter(shift => shift.changed).length,
      normalizeTestCash,
      shiftCashChanges: normalizeTestCash
        ? shiftUpdates.map(shift => ({
            shiftId: shift.id,
            previousKasHitung: shift.previousKasHitung,
            previousKasAkhir: shift.previousKasAkhir,
            nextKasHitung: shift.nextKasHitung,
            selisih: shift.selisih,
          }))
        : [],
      closedBillsWithAmbiguousMethod: ambiguousBills,
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  console.log(JSON.stringify(report, null, 2))
  if (report.closedBillsWithAmbiguousMethod > 0) {
    console.warn("Ambiguous legacy bills were left unchanged; their tender allocation cannot be inferred safely.")
  }
  if (!applyChanges) {
    console.log("No data changed. Re-run with --apply to apply the safe, idempotent repairs.")
  }
  if (normalizeTestCash && !applyChanges) {
    console.log("Test shift cash values are only normalized when both --normalize-test-cash and --apply are provided.")
  }
}

main()
  .catch(error => {
    console.error("Historical payment reconciliation failed.", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
