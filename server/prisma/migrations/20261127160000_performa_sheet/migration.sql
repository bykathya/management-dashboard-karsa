-- Daily Sheet › Performa, Bonus & Lembur (Karsa Circle, 27 Nov 2026)
-- CreateTable
CREATE TABLE "PerformaSheet" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "poolAdmin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poolArtis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "komisiPersen" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "kurs" DOUBLE PRECISION,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformaSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformaOrang" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "akunId" TEXT,
    "targetUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "persen" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformaOrang_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformaSheet_studioId_tahun_bulan_key" ON "PerformaSheet"("studioId", "tahun", "bulan");

-- CreateIndex
CREATE INDEX "PerformaOrang_studioId_tahun_bulan_idx" ON "PerformaOrang"("studioId", "tahun", "bulan");

-- CreateIndex
CREATE UNIQUE INDEX "PerformaOrang_studioId_tahun_bulan_userId_jenis_key" ON "PerformaOrang"("studioId", "tahun", "bulan", "userId", "jenis");
