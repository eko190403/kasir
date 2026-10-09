# Kasir Bar POS

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

6. Push schema ke database

```bash
npm run db:push
```

7. Jalankan seeding data awal

```bash
npm run db:seed
```

8. Jalankan server pengembangan

```bash
npm run dev
```

Buka `http://localhost:3000`.

## Migrasi database production

Build Vercel menjalankan `prisma migrate deploy` sebelum build aplikasi. Untuk database production yang sudah berisi data tetapi belum memiliki riwayat Prisma Migrate:

1. Buat backup database dan pastikan skema yang sedang berjalan cocok dengan `prisma/schema.prisma`.
2. Tandai baseline sebagai sudah diterapkan tanpa menjalankan SQL pembuat tabel:

```bash
npx prisma migrate resolve --applied 20261008000000_baseline_existing_schema
```

3. Jalankan `npm run db:migrate` sekali terhadap database production untuk menambahkan kolom kas fisik, lalu deploy aplikasi.
4. Pastikan `DATABASE_URL` dan `DIRECT_URL` tersedia untuk build production di Vercel.

Jangan tandai baseline sebagai applied jika database kosong atau skemanya berbeda. Untuk database baru, jalankan `npm run db:migrate` tanpa langkah baseline; migrasi akan membuat skema dan menerapkan perubahan kas. Setiap database Preview yang sudah berisi tabel juga perlu dibaseline sebelum build Vercel menjalankan migrasi.

## Konfigurasi environment

Contoh isi `.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/kasir_bar?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/kasir_bar?schema=public"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
JWT_SECRET="gantikan-dengan-string-rahasia-yang-kuat"
```

## Data default yang di-seed

Setelah menjalankan `npm run db:seed`, sistem akan menyiapkan:

- Sofa / meja default sesuai kebutuhan bar
- Menu makanan dan minuman awal
- User staf default
- Setting pajak, service charge, dan happy hour

### Login default

- PIN staf umum: `123456`
- PIN manager: `999999`

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
npm run db:push
```

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
