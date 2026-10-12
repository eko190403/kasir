"use client"

import { useEffect } from "react"

type ReceiptItem = {
  id: string
  namaItem: string
  harga: number
  qty: number
  catatan?: string | null
  isHappyHour?: boolean
}

type Payment = {
  id: string
  metode: string
  jumlah: number
}

type BillData = {
  id: string
  nomorBill: number | null
  tipe: string
  waktuBuka: Date | string
  waktuTutup?: Date | string | null
  subtotal: number
  diskon: number
  service: number
  pajak: number
  pembulatan: number
  total: number
  uangDiterima?: number | null
  kembalian?: number | null
  metodeBayar?: string | null
  sofa?: { nama: string } | null
  kasir?: { nama: string } | null
  billItems: ReceiptItem[]
  payments: Payment[]
}

const formatMoney = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`

export default function PrintReceiptClient({
  bill,
  namaBar,
  alamatBar,
}: {
  bill: BillData
  namaBar: string
  alamatBar: string
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        window.focus()
        window.print()
      } catch (error) {
        console.error("Print failed", error)
      }
    }, 150)

    const onAfterPrint = () => {
      try {
        window.close()
      } catch {
        // noop
      }
    }

    window.addEventListener("afterprint", onAfterPrint)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("afterprint", onAfterPrint)
    }
  }, [])

  const paymentMethod = (bill.metodeBayar || 'TUNAI').toUpperCase()
  const normalItems = bill.billItems.filter((item) => !item.isHappyHour || true)
  const compItems = []

  return (
    <div className="bg-white text-black min-h-screen p-8 font-mono text-sm print:p-0">
      <div className="max-w-[80mm] mx-auto pb-8">
        <div className="text-center mb-6 border-b border-dashed border-black pb-4">
          <h1 className="text-[22px] font-black tracking-tight">{namaBar}</h1>
          <p className="text-[10px] mt-1">{alamatBar}</p>
          <p className="font-bold mt-2 text-[11px] tracking-[0.2em]">RECEIPT / LUNAS</p>
        </div>

        <div className="mb-4 space-y-1 text-[11px]">
          <div className="flex justify-between gap-3">
            <span>Bill</span>
            <span>{bill.nomorBill ? `#${bill.nomorBill.toString().padStart(3, '0')}` : bill.id.slice(0, 6).toUpperCase()}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Waktu</span>
            <span>{new Date(bill.waktuTutup || bill.waktuBuka).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Kasir</span>
            <span>{bill.kasir?.nama || '-'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Sofa</span>
            <span>{bill.sofa?.nama || bill.tipe}</span>
          </div>
        </div>

        <div className="border-t border-b border-dashed border-black py-4 mb-4">
          {normalItems.length === 0 ? (
            <p className="text-center text-gray-500 italic text-[10px]">Tidak ada item</p>
          ) : (
            normalItems.map(item => (
              <div key={item.id} className="mb-2">
                <div className="flex justify-between gap-2">
                  <span className="max-w-[60%] break-words">
                    {item.namaItem}{item.isHappyHour ? " (Happy Hour)" : ""}
                  </span>
                  <span>{formatMoney(item.harga * item.qty)}</span>
                </div>
                <div className="text-gray-500 ml-1 text-[10px]">
                  {item.qty} x {formatMoney(item.harga)}
                  {item.catatan ? ` • ${item.catatan}` : ''}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatMoney(bill.subtotal)}</span>
          </div>
          {bill.diskon > 0 && (
            <div className="flex justify-between text-red-700">
              <span>Diskon</span>
              <span>- {formatMoney(bill.diskon)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Service</span>
            <span>{formatMoney(bill.service)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>{formatMoney(bill.pajak)}</span>
          </div>
          {bill.pembulatan !== 0 && (
            <div className="flex justify-between">
              <span>Pembulatan</span>
              <span>{formatMoney(bill.pembulatan)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-base mt-2 pt-2 border-t border-dashed border-black">
            <span>TOTAL</span>
            <span>{formatMoney(bill.total)}</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-dashed border-black space-y-1 text-[11px]">
          {bill.payments.length > 0 ? bill.payments.map(payment => (
            <div className="flex justify-between" key={payment.id}>
              <span>{payment.metode}</span>
              <span>{formatMoney(payment.jumlah)}</span>
            </div>
          )) : (
            <div className="flex justify-between font-bold">
              <span>DIBAYAR ({paymentMethod})</span>
              <span>{formatMoney(bill.total)}</span>
            </div>
          )}
          {bill.uangDiterima !== null && bill.uangDiterima !== undefined && (
            <div className="flex justify-between">
              <span>TUNAI DITERIMA</span>
              <span>{formatMoney(bill.uangDiterima)}</span>
            </div>
          )}
          {bill.kembalian !== null && bill.kembalian !== undefined && bill.kembalian > 0 && (
            <div className="flex justify-between">
              <span>KEMBALI</span>
              <span>{formatMoney(bill.kembalian)}</span>
            </div>
          )}
        </div>

        <div className="text-center mt-8 border-t border-dashed border-black pt-4 text-[10px]">
          <p className="font-bold text-[12px]">TERIMA KASIH</p>
          <p className="mt-1">Layanan Anda kebanggaan kami.</p>
        </div>
      </div>
    </div>
  )
}
