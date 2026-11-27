-- Info & Dokumen (Karsa, 27 Nov 2026)
-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "jamEvent" TEXT,
ADD COLUMN     "jenis" TEXT NOT NULL DEFAULT 'PENGUMUMAN',
ADD COLUMN     "tanggalEvent" DATE,
ADD COLUMN     "tautan" TEXT;
