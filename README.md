# Superbar POS

Aplikasi Point of Sale untuk bisnis bar dan restoran yang dibangun dengan Next.js, Prisma, dan PostgreSQL. Sistem ini mencakup login staf, transaksi dine-in/take away/reservasi, pengelolaan menu, board dapur dan bar, serta laporan harian.

## Fitur utama

- Login staf dengan PIN dan role-based access
- Transaksi: Dine In, Take Away, Reservasi
- Manajemen meja/sofa dan status ketersediaan
- Menu makanan dan minuman dengan status tersedia / tidak tersedia
- Board dapur dan bar dengan status: DIKIRIM, DIPROSES, SIAP
- Pembayaran bill dan penutupan transaksi
- Shift kasir dan laporan harian (EOD)
- Audit log sederhana untuk aktivitas penting
- Print struk / export CSV

## Katalog menu

Katalog POS mengikuti menu LSD Oktober, termasuk paket dan promo happy hour pukul 21.00–23.00 WIB. Harga dalam katalog adalah harga nett; PAJAK dan SERVICE_CHARGE untuk bill baru disetel ke 0 agar tidak ditambahkan lagi. Sinkronkan katalog dari `lib/menu-catalog.ts` dengan:

```bash
npm run db:sync-menu
```

Item lama dinonaktifkan secara soft-delete agar riwayat bill tetap utuh.

## Stack teknologi

- Next.js 16
- React 19
- TypeScript
- Prisma ORM
- PostgreSQL
- Supabase Realtime (untuk board dapur/bar)
- JWT cookie session
- Tailwind CSS

## Struktur utama

- `app/` — halaman aplikasi dan server actions
- `components/` — komponen UI dan realtime board
- `lib/` — utilitas, auth, kalkulasi bill, supabase client
- `prisma/` — schema Prisma dan seed script
- `public/` — aset statis

## Persyaratan

- Node.js 20+
- PostgreSQL 14+
- npm
- (Opsional) Supabase project untuk realtime

## Setup lokal

1. Clone repo
2. Copy file `.env.example` ke `.env` dan isi nilai sesuai environment lokal
3. Buat database PostgreSQL baru
4. Install dependency

```bash
npm install
```

5. Generate Prisma client

```bash
npx prisma generate
```

6. Terapkan migrasi database

```bash
npx prisma migrate deploy
```

Migrasi membuat schema awal untuk database baru atau menambahkan perubahan pada database yang sudah di-baseline. Backfill menyesuaikan nomor bill ke hari operasional pukul 06.00 WIB dan menyimpan metode pembayaran lama yang dapat dipastikan. Detail pembayaran split historis yang tidak pernah disimpan tidak dapat direkonstruksi.

7. (Opsional) Atur `INITIAL_STAFF_PIN` dan `INITIAL_MANAGER_PIN` di environment dengan PIN acak 4–6 digit, lalu jalankan seeding data awal

```bash
npm run db:seed
```

8. Jalankan server pengembangan

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Migrasi database

Build Production Vercel menjalankan `prisma migrate deploy` sebelum build aplikasi. Build Preview tidak menjalankan migrasi.

Untuk database production yang sudah berisi data tetapi belum memiliki riwayat Prisma Migrate:

1. Buat backup database dan pastikan skema yang sedang berjalan cocok dengan `prisma/schema.prisma`.
2. Sebelum deploy production pertama, tandai baseline sebagai sudah diterapkan tanpa menjalankan SQL pembuat tabel:

```bash
npx prisma migrate resolve --applied 20261008000000_baseline_existing_schema
```

3. Pastikan `DATABASE_URL` dan `DIRECT_URL` tersedia sebagai production environment variables di Vercel. Nilainya tidak perlu diunduh ke lokal.
4. Deploy ke production. Build akan menerapkan migrasi kas fisik yang hanya menambahkan kolom nullable.

Jangan tandai baseline sebagai applied jika database kosong atau skemanya berbeda. Untuk database baru, deploy production akan menerapkan baseline dan migrasi kas secara berurutan. Untuk migrasi manual, jalankan `npm run db:migrate` dengan `DATABASE_URL` dan `DIRECT_URL` yang sesuai.

## Konfigurasi environment

Contoh isi `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/kasir_bar?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/kasir_bar?schema=public"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
JWT_SECRET="isi-dengan-rahasia-acak-minimal-32-byte"
INITIAL_STAFF_PIN=""
INITIAL_MANAGER_PIN=""
```

Generate secret baru dengan:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Jangan gunakan ulang nilai secret contoh. Mengganti `JWT_SECRET` membatalkan seluruh sesi login yang masih aktif.

## Data default yang di-seed

Setelah menjalankan `npm run db:seed`, sistem akan menyiapkan:

- Sofa / meja default sesuai kebutuhan bar
- Menu makanan dan minuman awal
- User staf default
- Setting pajak, service charge, dan happy hour

Seed membutuhkan `INITIAL_STAFF_PIN` dan `INITIAL_MANAGER_PIN`; tidak ada PIN default yang ditanam di source atau dicetak ke log. Seed juga mempertahankan PIN pengguna yang sudah ada.

Role default yang disediakan:

- `KASIR`
- `PELAYAN`
- `BARTENDER`
- `DAPUR`
- `MANAJER`

## Perintah umum

```bash
npm run dev
npm run build
npm run lint
npx prisma studio
npm run db:seed
npm run db:reconcile-history
```

`db:reconcile-history` runs in dry-run mode by default. Review its counts, then
pass `-- --apply` to backfill only unambiguous legacy payment methods, confirm
pending payments on already-closed bills, and recalculate closed-shift sales
and cash differences. Historical mixed-method bills without saved allocations
are left unchanged because their cash/non-cash split cannot be inferred safely.
For a database confirmed to contain only test transactions, add
`-- --apply --normalize-test-cash` to also replace each closed test shift's
physical closing cash with cash expected from confirmed cash tenders and
recalculate the closing difference. Never use that option on live accounting
data.

## Catatan pengembangan

Project ini masih dalam fase pengembangan aktif. Prioritas utama yang perlu terus dibenahi adalah:

1. dokumentasi setup dan operasional
2. validasi per-role dan permission
3. flow pembayaran serta closing shift
4. laporan harian dan analitik
5. peningkatan hardening dan production readiness

## Referensi cepat

- [prisma/schema.prisma](./prisma/schema.prisma)
- [prisma/seed.ts](./prisma/seed.ts)
- [app/actions.ts](./app/actions.ts)
- [lib/bill.ts](./lib/bill.ts)
