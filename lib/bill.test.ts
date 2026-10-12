import { expect, test, describe } from 'vitest'
import { computeBillMathematics } from './bill-math'

describe('Kalkulasi Bill POS', () => {
  test('Hitung normal: Subtotal + Service (5%) + Pajak (10%)', () => {
    const items = [
      { harga: 50000, qty: 2, diretur: false, isVoid: false, isComp: false }, // 100,000
      { harga: 25000, qty: 1, diretur: false, isVoid: false, isComp: false }, // 25,000
    ]
    // Subtotal: 125,000
    // Diskon: 0
    // Service 5%: 6,250
    // Pajak 10% dari (125,000 + 6,250 = 131,250): 13,125
    // Total: 131,250 + 13,125 = 144,375

    const hasil = computeBillMathematics({
      items,
      diskon: 0,
      pajakRate: 10,
      serviceRate: 5,
      pembulatanRatusan: false
    })

    expect(hasil.subtotal).toBe(125000)
    expect(hasil.service).toBe(6250)
    expect(hasil.pajak).toBe(13125)
    expect(hasil.total).toBe(144375)
  })

  test('Pembulatan ratusan aktif', () => {
    // 33,333
    // Service 5% = 1667
    // Pajak 10% dari 35,000 = 3500
    // Total = 38500 (sudah bulat). Let's use a weirder number.
    
    const hasil = computeBillMathematics({
      items: [{ harga: 12345, qty: 1, diretur: false, isVoid: false, isComp: false }],
      diskon: 0,
      pajakRate: 10,
      serviceRate: 5,
      pembulatanRatusan: true
    })

    // Subtotal: 12345
    // Service 5%: 617.25 -> 617
    // Total Kena Pajak: 12962
    // Pajak 10%: 1296.2 -> 1296
    // Total: 14258
    // Dibulatkan ratusan: 14300

    expect(hasil.total % 100).toBe(0)
    expect(hasil.total).toBe(14300)
  })

  test('Item void/retur/comp tidak dihitung ke subtotal', () => {
    const items = [
      { harga: 50000, qty: 1, diretur: false, isVoid: false, isComp: false },
      { harga: 50000, qty: 1, diretur: true, isVoid: false, isComp: false }, // retur
      { harga: 50000, qty: 1, diretur: false, isVoid: true, isComp: false }, // void
      { harga: 50000, qty: 1, diretur: false, isVoid: false, isComp: true }, // comp
    ]

    const hasil = computeBillMathematics({
      items,
      diskon: 0,
      pajakRate: 10,
      serviceRate: 5,
      pembulatanRatusan: false
    })

    // Hanya 1 item (50.000) yang dihitung
    expect(hasil.subtotal).toBe(50000)
  })

  test('Diskon mengurangi dasar pengenaan service dan pajak', () => {
    const items = [
      { harga: 100000, qty: 1, diretur: false, isVoid: false, isComp: false },
    ]

    const hasil = computeBillMathematics({
      items,
      diskon: 20000, // Diskon 20k
      pajakRate: 10,
      serviceRate: 5,
      pembulatanRatusan: false
    })

    // Subtotal: 100,000
    // Diskon: 20,000
    // Dasar pengenaan (Setelah diskon): 80,000
    // Service 5%: 4,000
    // Pajak 10% (dari 84,000): 8,400
    // Total: 84,000 + 8,400 = 92,400

    expect(hasil.subtotal).toBe(100000)
    expect(hasil.service).toBe(4000)
    expect(hasil.pajak).toBe(8400)
    expect(hasil.total).toBe(92400)
  })

  test('Diskon lebih besar dari subtotal tidak membuat total negatif', () => {
    const items = [
      { harga: 50000, qty: 1, diretur: false, isVoid: false, isComp: false },
    ]

    const hasil = computeBillMathematics({
      items,
      diskon: 100000, // Diskon 100k
      pajakRate: 10,
      serviceRate: 5,
      pembulatanRatusan: false
    })

    expect(hasil.subtotal).toBe(50000)
    expect(hasil.diskon).toBe(50000)
    expect(hasil.service).toBe(0)
    expect(hasil.pajak).toBe(0)
    expect(hasil.total).toBe(0)
  })

  test('Diskon negatif tidak dapat menaikkan total', () => {
    const hasil = computeBillMathematics({
      items: [{ harga: 10000, qty: 1, diretur: false, isVoid: false, isComp: false }],
      diskon: -5000,
      pajakRate: 0,
      serviceRate: 0,
      pembulatanRatusan: false
    })

    expect(hasil.diskon).toBe(0)
    expect(hasil.total).toBe(10000)
  })

  test('Tarif 0% tetap 0 dan rate NaN tidak merusak total', () => {
    const hasil = computeBillMathematics({
      items: [{ harga: 10000, qty: 1, diretur: false, isVoid: false, isComp: false }],
      diskon: 0,
      pajakRate: 0,
      serviceRate: Number.NaN,
      pembulatanRatusan: false
    })

    expect(hasil.service).toBe(0)
    expect(hasil.pajak).toBe(0)
    expect(hasil.total).toBe(10000)
  })

  test('Tarif pecahan menghitung tanpa kehilangan presisi', () => {
    const hasil = computeBillMathematics({
      items: [{ harga: 12345, qty: 1, diretur: false, isVoid: false, isComp: false }],
      diskon: 0,
      pajakRate: 10,
      serviceRate: 2.5,
      pembulatanRatusan: false
    })

    expect(hasil.service).toBe(309)
    expect(hasil.pajak).toBe(1265)
    expect(hasil.total).toBe(13919)
  })

  test('Pembulatan memakai Math.round untuk nilai tepat di bawah dan pada setengah', () => {
    const calculateRoundedTotal = (harga: number) => computeBillMathematics({
      items: [{ harga, qty: 1, diretur: false, isVoid: false, isComp: false }],
      diskon: 0,
      pajakRate: 0,
      serviceRate: 0,
      pembulatanRatusan: true
    })

    expect(calculateRoundedTotal(14240)).toMatchObject({ total: 14200, pembulatan: -40 })
    expect(calculateRoundedTotal(14250)).toMatchObject({ total: 14300, pembulatan: 50 })
  })

  test('Harga pecahan dibulatkan sebelum dikalikan dengan tarif', () => {
    const hasil = computeBillMathematics({
      items: [{ harga: 11110.5, qty: 1, diretur: false, isVoid: false, isComp: false }],
      diskon: 0,
      pajakRate: 0,
      serviceRate: 0,
      pembulatanRatusan: false
    })

    expect(hasil.subtotal).toBe(11111)
    expect(hasil.total).toBe(11111)
  })
})
