import type { MenuKategori } from "@prisma/client"

export type MenuCatalogItem = {
  nama: string
  harga: number
  kategori: MenuKategori
  hargaAsli?: number
}

const food = "MAKANAN" satisfies MenuKategori
const drink = "MINUMAN" satisfies MenuKategori

export const menuCatalog = [
  { nama: "French Fries / 150gr", harga: 35_000, kategori: food },
  { nama: "Cheezy Fries / 150gr", harga: 40_000, kategori: food },
  { nama: "Chicken Skin", harga: 35_000, kategori: food },
  { nama: "Edamame", harga: 25_000, kategori: food },
  { nama: "Chicken Wings", harga: 35_000, kategori: food },
  { nama: "Snack Platter", harga: 45_000, kategori: food },
  { nama: "Tahu Cabai Garam", harga: 25_000, kategori: food },
  { nama: "Pizza Whole Neopolitan Spicy Dialova Honey", harga: 135_000, kategori: food },
  { nama: "Rice Bowl Ayam Cabai Garam", harga: 49_000, kategori: food },
  { nama: "Rice Bowl Ayam Teriyaki", harga: 49_000, kategori: food },
  { nama: "Mie Goreng ala LSD", harga: 35_000, kategori: food },
  { nama: "Mie Kuah ala LSD", harga: 35_000, kategori: food },
  { nama: "Fruit Platter", harga: 35_000, kategori: food },
  { nama: "Steamed Rice", harga: 10_000, kategori: food },

  { nama: "Jameson", harga: 1_049_000, kategori: drink },
  { nama: "Jim Beam Apple", harga: 999_000, kategori: drink },
  { nama: "Batavia Whiskey", harga: 549_000, kategori: drink },
  { nama: "Carson Whiskey", harga: 559_000, kategori: drink },
  { nama: "Jack Daniel's Old No. 7", harga: 1_249_000, kategori: drink },
  { nama: "Jack Daniel's Tennessee Apple", harga: 1_449_000, kategori: drink },
  { nama: "Singleton 12 y.o", harga: 1_949_000, kategori: drink },
  { nama: "Chivas Regal 12y", harga: 1_299_000, kategori: drink },
  { nama: "Omrach Whiskey", harga: 499_000, kategori: drink },
  { nama: "High Commissioner Whiskey", harga: 899_000, kategori: drink },
  { nama: "Martel VSOP", harga: 2_299_000, kategori: drink },
  { nama: "Martel XO", harga: 7_499_000, kategori: drink },
  { nama: "Iceland", harga: 449_000, kategori: drink },
  { nama: "Smirnoff Red", harga: 549_000, kategori: drink },
  { nama: "Carson Vodka", harga: 559_000, kategori: drink },
  { nama: "Seagram Vodka", harga: 599_000, kategori: drink },
  { nama: "Absolute Vodka", harga: 999_000, kategori: drink },
  { nama: "Captain Morgan Spiced Gold", harga: 670_000, kategori: drink },
  { nama: "Nusa Cana Dark", harga: 699_000, kategori: drink },
  { nama: "Two Rogues Spiced Rum", harga: 499_000, kategori: drink },
  { nama: "Jägermeister", harga: 897_000, kategori: drink },
  { nama: "Bailey's Irish Cream", harga: 999_000, kategori: drink },
  { nama: "Jinro Soju - Chamisul Fresh", harga: 220_000, kategori: drink },
  { nama: "Jinro Soju - Peach", harga: 220_000, kategori: drink },
  { nama: "Jinro Soju - Strawberry", harga: 220_000, kategori: drink },
  { nama: "Jinro Soju - Green Grape", harga: 220_000, kategori: drink },
  { nama: "Jinro Soju - Plum", harga: 220_000, kategori: drink },
  { nama: "Gordon Pink", harga: 720_000, kategori: drink },
  { nama: "Roku Gin", harga: 1_380_000, kategori: drink },
  { nama: "Jose Cuervo Especial Reposado", harga: 899_000, kategori: drink },
  { nama: "Sierra Tequila", harga: 830_000, kategori: drink },
  { nama: "Clase Azul Reposado", harga: 10_500_000, kategori: drink },
  { nama: "ORO TequilaNa", harga: 480_000, kategori: drink },
  { nama: "Codigo", harga: 3_349_000, kategori: drink },
  { nama: "Arak (Lychee / Apple / Mango)", harga: 88_000, kategori: drink },
  { nama: "Bintang 620ml", harga: 79_000, kategori: drink },
  { nama: "Bintang Tower", harga: 330_000, kategori: drink },
  { nama: "Singaraja 620ml", harga: 75_000, kategori: drink },
  { nama: "Singaraja Tower", harga: 257_000, kategori: drink },
  { nama: "Coca-Cola / 330ml", harga: 30_000, kategori: drink },
  { nama: "Sprite", harga: 30_000, kategori: drink },
  { nama: "Schweppes Tonic Water / 330ml", harga: 30_000, kategori: drink },
  { nama: "Schweppes Soda Water / 330ml", harga: 30_000, kategori: drink },
  { nama: "Schweppes Ginger Ale / 330ml", harga: 30_000, kategori: drink },
  { nama: "Red Bull / 330ml", harga: 67_000, kategori: drink },
  { nama: "Crystalin PET / 600ml", harga: 25_000, kategori: drink },
  { nama: "Orange Juice", harga: 45_000, kategori: drink },
  { nama: "Jasmine Tea", harga: 17_000, kategori: drink },
  { nama: "Shisha - Fruity Flavor", harga: 175_000, kategori: drink },
  { nama: "TEREA (All Variant)", harga: 99_000, kategori: drink },
  { nama: "VEEV NOW ULTRA (All Variant)", harga: 49_000, kategori: drink },

  { nama: "HAPPY HOUR 21-23 - Smirnoff Red + Free Mixer", harga: 449_000, hargaAsli: 549_000, kategori: drink },
  { nama: "HAPPY HOUR 21-23 - Iceland + Free Mixer", harga: 349_000, hargaAsli: 449_000, kategori: drink },
  { nama: "HAPPY HOUR 21-23 - Jose Cuervo + Free Mixer", harga: 720_000, hargaAsli: 899_000, kategori: drink },
  { nama: "HAPPY HOUR 21-23 - Carson Vodka + Free Mixer", harga: 399_000, hargaAsli: 559_000, kategori: drink },
  { nama: "HAPPY HOUR 21-23 - Seagram Vodka + Free Mixer", harga: 449_000, hargaAsli: 599_000, kategori: drink },
  { nama: "HAPPY HOUR 21-23 - Batavia + Free Mixer", harga: 449_000, hargaAsli: 599_000, kategori: drink },

  { nama: "Arak Best Deal - Buy 3 Get 4", harga: 264_000, kategori: drink },
  { nama: "Twin Bottle - 2 Icelands + Cola + French Fries", harga: 799_000, kategori: drink },
  { nama: "Twin Bottle - 2 Smirnoff Reds + Soda Water + Platter", harga: 999_000, kategori: drink },
  { nama: "Twin Bottle - 2 Carson Vodkas + Cola + French Fries", harga: 999_000, kategori: drink },
  { nama: "Twin Bottle - 2 Batavia Whiskeys + Soda Water + French Fries", harga: 999_000, kategori: drink },
  { nama: "Twin Bottle - 2 Omrach Whiskeys + Cola + French Fries", harga: 899_000, kategori: drink },
  { nama: "Twin Bottle - 2 Two Rogues Spiced Rums + Cola + French Fries", harga: 899_000, kategori: drink },
  { nama: "Twin Bottle - 2 ORO TequilaNa + Cola + French Fries", harga: 849_000, kategori: drink },
  { nama: "Twin Bottle - 2 High Commissioner + Cola + Platter", harga: 1_699_000, kategori: drink },
  { nama: "Jinro Soju Bundle - Mix Variants", harga: 550_000, kategori: drink },
  { nama: "Suit Up - 2 Jamesons + Ginger Ale + Platter", harga: 1_999_000, kategori: drink },
  { nama: "Suit Up - 2 Jim Beam Apples + Soda Water + Platter", harga: 1_899_000, kategori: drink },
  { nama: "Suit Up - 2 Jägermeisters + Cola + Platter", harga: 1_699_000, kategori: drink },
  { nama: "Suit Up - 2 Captain Morgan Spiced Golds + Cola + French Fries", harga: 1_250_000, kategori: drink },
  { nama: "Suit Up - 2 Jose Cuervos + Cola + Platter", harga: 1_699_000, kategori: drink },
  { nama: "Suit Up - 2 Gordon Pinks + Tonic Water + Platter", harga: 1_399_000, kategori: drink },
  { nama: "Top Spender - 2 Singletons 12 y.o + Ginger Ale + Platter", harga: 3_899_000, kategori: drink },
  { nama: "Top Spender - 2 Jack Daniel's Old No. 7 + Cola + Platter", harga: 2_399_000, kategori: drink },
  { nama: "Top Spender - 2 Jack Daniel's Tennessee Apples + Soda Water + Platter", harga: 2_799_000, kategori: drink },
  { nama: "Top Spender - 2 Roku Gins + Platter + Mineral Water", harga: 2_650_000, kategori: drink },
] satisfies MenuCatalogItem[]

export const happyHourMenuPrefix = "HAPPY HOUR 21-23 - "

export function isHappyHourMenuName(name: string): boolean {
  return typeof name === 'string' && name.trim().startsWith(happyHourMenuPrefix)
}

export function applyHappyHourDiscount(price: number, discountPercent: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0
  const safePercent = Math.min(Math.max(Number(discountPercent) || 0, 0), 100)
  return Math.max(0, Math.round(price * (1 - safePercent / 100)))
}

export function getHappyHourOriginalPrice(name: string): number | null {
  const match = menuCatalog.find(item => item.nama === name && item.hargaAsli !== undefined)
  return match ? Number(match.hargaAsli) : null
}

export function isHappyHourWindowActive(currentTime: string, start: string = '21:00', end: string = '23:00'): boolean {
  const toMinutes = (value: string) => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
    if (!match) throw new Error('Jam harus menggunakan format HH:mm.')
    return Number(match[1]) * 60 + Number(match[2])
  }

  const currentMinutes = toMinutes(currentTime)
  const startMinutes = toMinutes(start)
  const endMinutes = toMinutes(end)

  return startMinutes <= endMinutes
    ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
    : currentMinutes >= startMinutes || currentMinutes <= endMinutes
}

export function resolveHappyHourPrice(
  name: string,
  basePrice: number,
  discountPercent: number,
  currentTime: string,
  start: string = '21:00',
  end: string = '23:00'
) {
  const originalPrice = getHappyHourOriginalPrice(name)
  const isFixedHappyHour = isHappyHourMenuName(name)
  const isActive = isFixedHappyHour && isHappyHourWindowActive(currentTime, start, end)

  return {
    isFixedHappyHour,
    isActive,
    originalPrice,
    finalPrice: isActive && originalPrice !== null && Number.isFinite(basePrice)
      ? applyHappyHourDiscount(basePrice, discountPercent)
      : basePrice
  }
}
