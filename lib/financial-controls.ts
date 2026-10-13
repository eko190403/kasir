export type PaymentMethod = "TUNAI" | "KARTU" | "QRIS" | "DEBIT" | "TRANSFER"
export type PaymentEntryStatus = "PENDING" | "SUDAH_BAYAR"

const PAYMENT_METHODS: readonly PaymentMethod[] = [
  "TUNAI",
  "KARTU",
  "QRIS",
  "DEBIT",
  "TRANSFER",
]

export function paymentStatusForMethod(method: string): PaymentEntryStatus {
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) {
    throw new Error("Metode pembayaran tidak valid.")
  }

  return method === "QRIS" || method === "DEBIT" || method === "TRANSFER"
    ? "PENDING"
    : "SUDAH_BAYAR"
}

export function validatePaymentReference(reference: unknown): string {
  if (typeof reference !== "string") {
    throw new Error("Nomor referensi pembayaran wajib diisi saat konfirmasi.")
  }

  const cleaned = reference.trim()
  if (!cleaned) {
    throw new Error("Nomor referensi pembayaran wajib diisi saat konfirmasi.")
  }
  if (cleaned.length < 3 || cleaned.length > 120) {
    throw new Error("Nomor referensi pembayaran harus terdiri dari 3–120 karakter.")
  }

  return cleaned
}
