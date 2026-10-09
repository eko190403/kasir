const MAX_DATABASE_INT = 2_147_483_647
const MAX_EXPENSE_NOTE_LENGTH = 500

export function normalizeShiftExpenseInput(jumlah: unknown, catatan: unknown) {
  if (
    typeof jumlah !== "number" ||
    !Number.isSafeInteger(jumlah) ||
    jumlah <= 0 ||
    jumlah > MAX_DATABASE_INT
  ) {
    throw new Error("Jumlah pengeluaran harus berupa rupiah bulat lebih dari 0.")
  }

  if (typeof catatan !== "string") {
    throw new Error("Catatan pengeluaran wajib diisi.")
  }

  const cleanedCatatan = catatan.trim()
  if (!cleanedCatatan) throw new Error("Catatan pengeluaran wajib diisi.")
  if (cleanedCatatan.length > MAX_EXPENSE_NOTE_LENGTH) {
    throw new Error(`Catatan pengeluaran maksimal ${MAX_EXPENSE_NOTE_LENGTH} karakter.`)
  }

  return { jumlah, catatan: cleanedCatatan }
}

export function nextShiftExpenseTotal(current: number, amount: number) {
  if (
    !Number.isSafeInteger(current) ||
    current < 0 ||
    current > MAX_DATABASE_INT ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > MAX_DATABASE_INT - current
  ) {
    throw new Error("Total pengeluaran shift melebihi batas penyimpanan.")
  }

  return current + amount
}
