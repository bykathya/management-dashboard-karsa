-- Daily Sheet (Karsa Circle, 27 Nov 2026)
-- AlterTable
ALTER TABLE "OrderProduksi" ADD COLUMN     "jalurBayar" TEXT,
ADD COLUMN     "partialUsd" DOUBLE PRECISION,
ADD COLUMN     "progresSheet" TEXT,
ADD COLUMN     "tipUsd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "InboxSheet" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "akunId" TEXT,
    "tanggal" DATE NOT NULL,
    "klien" TEXT NOT NULL,
    "produk" TEXT,
    "agreedUsd" DOUBLE PRECISION,
    "realUsd" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'TANYA',
    "jalurBayar" TEXT,
    "olehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxSheet_studioId_tanggal_idx" ON "InboxSheet"("studioId", "tanggal");
