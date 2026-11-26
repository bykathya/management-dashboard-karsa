-- Lembur dari tugas yang ditunda admin (ATURAN LEMBUR 3D ARTIST, 22 Nov 2026)
ALTER TABLE "PengaturanLembur" ADD COLUMN "lemburDariTunda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LemburKehadiran" ADD COLUMN "penugasanId" TEXT,
  ADD COLUMN "tahapDinilai" JSONB,
  ADD COLUMN "nilaiUsulan" DOUBLE PRECISION,
  ADD COLUMN "diusulkanOlehId" TEXT,
  ADD COLUMN "diusulkanOleh" TEXT,
  ADD COLUMN "diusulkanPada" TIMESTAMP(3);
CREATE INDEX "LemburKehadiran_penugasanId_idx" ON "LemburKehadiran"("penugasanId");
