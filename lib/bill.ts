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



// Pure function untuk testing dan kalkulasi tanpa efek samping
export function computeBillMathematics({
  items,
  diskon,
  pajakRate,
  serviceRate,
  pembulatanRatusan
}: {
  items: { harga: number, qty: number, diretur: boolean, isVoid: boolean, isComp: boolean }[],
  diskon: number,
  pajakRate: number,
  serviceRate: number,
  pembulatanRatusan: boolean
}) {
  // 1. Subtotal: only items that are not returned/voided/comped
  let subtotal = 0
  items.forEach(item => {
    if (!item.diretur && !item.isVoid && !item.isComp) {
      subtotal += item.harga * item.qty
    }
  })

  // 2. Diskon
  let totalSetelahDiskon = subtotal - diskon
  if (totalSetelahDiskon < 0) totalSetelahDiskon = 0

  // 3. Service charge
  const service = Math.round(totalSetelahDiskon * (serviceRate / 100))

  // 4. Pajak (on subtotal-diskon+service)
  const totalKenaPajak = totalSetelahDiskon + service
  const pajak = Math.round(totalKenaPajak * (pajakRate / 100))

  // 5. Total
  let total = totalKenaPajak + pajak

  // 6. Pembulatan
  if (pembulatanRatusan) {
    total = Math.round(total / 100) * 100
  }

  return { subtotal, diskon, service, pajak, total }
}

export async function calculateBillTotal(billId: string) {
  const [bill, settings] = await Promise.all([
    prisma.bill.findUnique({
      where: { id: billId },
      include: { billItems: true }
    }),
    prisma.setting.findMany({
      where: { kunci: { in: ['PAJAK', 'SERVICE_CHARGE', 'PEMBULATAN_RATUSAN'] } },
      select: { kunci: true, nilai: true }
    })
  ])

  if (!bill) throw new Error("Bill not found")

  // Use snapshot rates from bill; fallback to Settings for legacy bills
  let pajakRate = bill.pajakPct
  let serviceRate = bill.servicePct
  const settingsMap = new Map(settings.map(setting => [setting.kunci, setting.nilai]))

  if (pajakRate === 0 && serviceRate === 0) {
    pajakRate = parseFloat(settingsMap.get('PAJAK') || '0')
    serviceRate = parseFloat(settingsMap.get('SERVICE_CHARGE') || '0')
  }

  const { subtotal, diskon, service, pajak, total } = computeBillMathematics({
    items: bill.billItems,
    diskon: bill.diskon,
    pajakRate,
    serviceRate,
    pembulatanRatusan: settingsMap.get('PEMBULATAN_RATUSAN') === 'true'
  })

  await prisma.bill.update({
    where: { id: billId },
    data: { subtotal, service, pajak, total }
  })

  return { subtotal, diskon, service, pajak, total }
}
