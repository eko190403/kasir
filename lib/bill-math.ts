export type BillItemInput = {
  harga: number
  qty: number
  diretur: boolean
  isVoid: boolean
  isComp: boolean
}

function safeRate(rate: number) {
  if (!Number.isFinite(rate)) return 0
  return Math.min(Math.max(rate, 0), 100)
}

export function computeBillMathematics({
  items,
  diskon,
  pajakRate,
  serviceRate,
  pembulatanRatusan
}: {
  items: BillItemInput[]
  diskon: number
  pajakRate: number
  serviceRate: number
  pembulatanRatusan: boolean
}) {
  const subtotal = items.reduce((sum, item) => {
    if (item.diretur || item.isVoid || item.isComp) return sum
    if (!Number.isFinite(item.harga) || item.harga < 0 || !Number.isInteger(item.qty) || item.qty < 0) {
      throw new Error("Harga atau jumlah item tidak valid.")
    }
    return sum + Math.round(item.harga * item.qty)
  }, 0)

  const diskonEfektif = Math.min(Math.max(Number.isFinite(diskon) ? diskon : 0, 0), subtotal)
  const dasar = subtotal - diskonEfektif
  const service = Math.round(dasar * safeRate(serviceRate) / 100)
  const kenaPajak = dasar + service
  const pajak = Math.round(kenaPajak * safeRate(pajakRate) / 100)
  const totalMentah = kenaPajak + pajak
  const total = pembulatanRatusan ? Math.round(totalMentah / 100) * 100 : totalMentah

  return {
    subtotal,
    diskon: diskonEfektif,
    service,
    pajak,
    pembulatan: total - totalMentah,
    total
  }
}
