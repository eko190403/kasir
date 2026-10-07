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

  // Use snapshot rates from bill; fallback to Settings for legacy bills (pajakPct=0 && servicePct=0)
  let pajakRate = bill.pajakPct
  let serviceRate = bill.servicePct

  if (pajakRate === 0 && serviceRate === 0) {
    const settings = await getSettings()
    pajakRate = settings.pajak
    serviceRate = settings.serviceCharge
  }

  // 1. Subtotal: only items that are not returned/voided/comped
  let subtotal = 0
  bill.billItems.forEach(item => {
    if (!item.diretur && !item.isVoid && !item.isComp) {
      subtotal += item.harga * item.qty
    }
  })

  // 2. Diskon
  const diskon = bill.diskon
  let totalSetelahDiskon = subtotal - diskon
  if (totalSetelahDiskon < 0) totalSetelahDiskon = 0

  // 3. Service charge
  const service = Math.round(totalSetelahDiskon * (serviceRate / 100))

  // 4. Pajak (on subtotal-diskon+service)
  const totalKenaPajak = totalSetelahDiskon + service
  const pajak = Math.round(totalKenaPajak * (pajakRate / 100))

  // 5. Total
  let total = totalKenaPajak + pajak

  // 6. Pembulatan (only from Settings, not snapshot)
  const settings = await getSettings()
  if (settings.pembulatanRatusan) {
    total = Math.round(total / 100) * 100
  }

  await prisma.bill.update({
    where: { id: billId },
    data: { subtotal, service, pajak, total }
  })

  return { subtotal, diskon, service, pajak, total }
}
