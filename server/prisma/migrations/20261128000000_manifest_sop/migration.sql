-- Manifest bulanan & SOP per studio (Karsa Circle, 27 Nov 2026)
-- CreateTable
CREATE TABLE "Manifest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "bulan" INTEGER NOT NULL,
    "isi" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopPanduan" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "tag" TEXT,
    "judul" TEXT NOT NULL,
    "ket" TEXT,
    "poin" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "olehNama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SopPanduan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Manifest_tahun_bulan_idx" ON "Manifest"("tahun", "bulan");

-- CreateIndex
CREATE UNIQUE INDEX "Manifest_userId_tahun_bulan_key" ON "Manifest"("userId", "tahun", "bulan");

-- CreateIndex
CREATE INDEX "SopPanduan_studioId_kategori_idx" ON "SopPanduan"("studioId", "kategori");
