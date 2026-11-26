-- Follow up klien lama (24 Nov 2026, masukan tim): aktivitas marketer ditautkan ke direktori Klien
ALTER TABLE "AktivitasMarketer" ADD COLUMN "klienId" TEXT;
ALTER TABLE "AktivitasMarketer" ADD CONSTRAINT "AktivitasMarketer_klienId_fkey" FOREIGN KEY ("klienId") REFERENCES "KlienProduksi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AktivitasMarketer_klienId_idx" ON "AktivitasMarketer"("klienId");
