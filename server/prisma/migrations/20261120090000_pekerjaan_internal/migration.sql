-- Pekerjaan internal (20 Nov 2026, masukan tim): kartu kerja tanpa klien & tanpa uang — PORTO (portofolio) atau PERSIAPAN (dikerjakan sebelum
-- klien order, untuk mempercepat TAT). Tetap di papan/antrean/kinerja, tetapi BUKAN order klien (tidak dihitung omset/order masuk/laporan).
-- null = order klien biasa. PERSIAPAN bisa "Jadikan order klien" saat klien akhirnya order.
ALTER TABLE "OrderProduksi" ADD COLUMN "pekerjaanInternal" TEXT;
