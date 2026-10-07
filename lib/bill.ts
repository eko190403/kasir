import { prisma } from './prisma'

export async function getSettings() {
  const settings = await prisma.setting.findMany()
  const map = new Map<string, string>()
  settings.forEach(s => map.set(s.kunci, s.nilai))
  
  return {
    pajak: parseFloat(map.get('PAJAK') || '0'),
    serviceCharge: parseFloat(map.get('SERVICE_CHARGE') || '0'),
    pembulatanRatusan: map.get('PEMBULATAN_RATUSAN') === 'true',
  }
}

export async function calculateBillTotal(billId: string) {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { billItems: true }
  })

  if (!bill) throw new Error("Bill not found")

  const settings = await getSettings()

  // 1. Hitung subtotal: harga * qty untuk item yang tidak diretur
  let subtotal = 0
  bill.billItems.forEach(item => {
    if (!item.diretur && !item.isVoid && !item.isComp) {
      subtotal += item.harga * item.qty
    }
  })

  // 2. Diskon (sudah ada di tabel bill, diset oleh KASIR/MANAJER, default 0)
  const diskon = bill.diskon

  // 3. Service charge (berdasarkan persentase)
  // Aturan urutan: subtotal - diskon + service charge + pajak
  let totalSetelahDiskon = subtotal - diskon
  if (totalSetelahDiskon < 0) totalSetelahDiskon = 0

  const service = Math.round(totalSetelahDiskon * (settings.serviceCharge / 100))

  // 4. Pajak (dihitung dari subtotal - diskon + service charge)
  const totalKenaPajak = totalSetelahDiskon + service
  const pajak = Math.round(totalKenaPajak * (settings.pajak / 100))

  // 5. Total
  let total = totalKenaPajak + pajak

  // 6. Pembulatan (opsional, jika diset true)
  if (settings.pembulatanRatusan) {
    total = Math.round(total / 100) * 100
  }

  // Simpan nilai terhitung ke snapshot di bill
  await prisma.bill.update({
    where: { id: billId },
    data: {
      subtotal,
      service,
      pajak,
      total,
    }
  })

  return { subtotal, diskon, service, pajak, total }
}
