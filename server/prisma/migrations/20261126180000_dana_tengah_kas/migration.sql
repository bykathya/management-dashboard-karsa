-- Dana Tengah: riwayat saldo & catatan pemakaian (Karsa Circle, tahap 7, 26 Nov 2026)
-- CreateTable
CREATE TABLE "DanaTengahSaldo" (
    "id" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "catatan" TEXT,
    "olehId" TEXT,
    "olehNama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DanaTengahSaldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DanaTengahPakai" (
    "id" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "keperluan" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "olehId" TEXT,
    "olehNama" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DanaTengahPakai_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DanaTengahSaldo_tanggal_idx" ON "DanaTengahSaldo"("tanggal");

-- CreateIndex
CREATE INDEX "DanaTengahPakai_tanggal_idx" ON "DanaTengahPakai"("tanggal");
