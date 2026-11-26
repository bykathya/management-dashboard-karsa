-- Jadwal rutin Arus Kas (Karsa Circle, 26 Nov 2026): tugas bulanan per studio + centang per bulan
-- CreateTable
CREATE TABLE "JadwalRutin" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "hari" INTEGER NOT NULL,
    "tugas" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuatOleh" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JadwalRutin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JadwalCentang" (
    "id" TEXT NOT NULL,
    "jadwalId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "oleh" TEXT,
    "pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JadwalCentang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JadwalRutin_studioId_aktif_idx" ON "JadwalRutin"("studioId", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "JadwalCentang_jadwalId_bulan_key" ON "JadwalCentang"("jadwalId", "bulan");

-- AddForeignKey
ALTER TABLE "JadwalCentang" ADD CONSTRAINT "JadwalCentang_jadwalId_fkey" FOREIGN KEY ("jadwalId") REFERENCES "JadwalRutin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
