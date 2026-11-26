-- Pendapatan otomatis dari cicilan terikat ke order & cicilan asalnya (18 Nov 2026): order/cicilan terhapus → Pendapatan ikut terhapus,
-- tidak pernah tertinggal sebagai pemasukan tanpa sumber. Baris yatim (bila ada) dibersihkan dulu.
DELETE FROM "PenarikanPendapatan" WHERE "terminId" IS NOT NULL AND "terminId" NOT IN (SELECT "id" FROM "TerminBayarOrder");
DELETE FROM "PenarikanPendapatan" WHERE "orderId" IS NOT NULL AND "orderId" NOT IN (SELECT "id" FROM "OrderProduksi");
ALTER TABLE "PenarikanPendapatan" ADD CONSTRAINT "PenarikanPendapatan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OrderProduksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PenarikanPendapatan" ADD CONSTRAINT "PenarikanPendapatan_terminId_fkey" FOREIGN KEY ("terminId") REFERENCES "TerminBayarOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
