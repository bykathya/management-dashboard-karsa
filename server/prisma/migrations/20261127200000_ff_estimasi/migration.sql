-- Financial Forecasting baru: estimasi pengeluaran bulanan (Karsa, 27 Nov 2026)
-- CreateTable
CREATE TABLE "FfKategori" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" TEXT NOT NULL DEFAULT 'BIASA',
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FfKategori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FfItem" (
    "id" TEXT NOT NULL,
    "kategoriId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "userId" TEXT,
    "nama" TEXT NOT NULL,
    "rupiah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lunas" BOOLEAN NOT NULL DEFAULT false,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FfItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FfKategori_studioId_tahun_bulan_idx" ON "FfKategori"("studioId", "tahun", "bulan");

-- CreateIndex
CREATE INDEX "FfItem_studioId_tahun_bulan_idx" ON "FfItem"("studioId", "tahun", "bulan");

-- CreateIndex
CREATE INDEX "FfItem_kategoriId_idx" ON "FfItem"("kategoriId");

-- AddForeignKey
ALTER TABLE "FfItem" ADD CONSTRAINT "FfItem_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "FfKategori"("id") ON DELETE CASCADE ON UPDATE CASCADE;
