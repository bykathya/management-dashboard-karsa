-- HR & Database (Karsa, 28 Nov 2026)
-- AlterTable
ALTER TABLE "ProfilSdm" ADD COLUMN     "kontrakAkhir" DATE,
ADD COLUMN     "kontrakMulai" DATE;

-- CreateTable
CREATE TABLE "DokumenAnggota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "berkas" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "olehId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DokumenAnggota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DokumenAnggota_userId_jenis_key" ON "DokumenAnggota"("userId", "jenis");
