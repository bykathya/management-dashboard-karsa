-- Detail Kas + Ekuitas (Karsa, 27 Nov 2026)
-- AlterTable
ALTER TABLE "StudioRekening" ADD COLUMN     "catatan" TEXT,
ADD COLUMN     "valid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validOleh" TEXT,
ADD COLUMN     "validPada" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PosKas" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "rupiah" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dolar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "atasNama" TEXT,
    "catatan" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT false,
    "validOleh" TEXT,
    "validPada" TIMESTAMP(3),
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosKas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuktiKas" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "rekeningId" TEXT,
    "posId" TEXT,
    "berkas" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "olehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuktiKas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosKas_studioId_idx" ON "PosKas"("studioId");

-- CreateIndex
CREATE INDEX "BuktiKas_studioId_idx" ON "BuktiKas"("studioId");
