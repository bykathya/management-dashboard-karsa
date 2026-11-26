-- Kas dari cicilan (18 Nov 2026, masukan tim + temuan audit): cicilan diterima dari order akun Komunitas/Internal (uang klien langsung
-- ke rekening unit) otomatis tercatat sebagai Pendapatan (penarikan) — tidak perlu dicatat dua kali. Tautan ke order & cicilan asalnya.
ALTER TABLE "PenarikanPendapatan" ADD COLUMN "orderId" TEXT;
ALTER TABLE "PenarikanPendapatan" ADD COLUMN "terminId" TEXT;
CREATE UNIQUE INDEX "PenarikanPendapatan_terminId_key" ON "PenarikanPendapatan"("terminId");
CREATE INDEX "PenarikanPendapatan_orderId_idx" ON "PenarikanPendapatan"("orderId");
