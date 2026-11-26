-- Lokasi kantor per unit + hasil cek lokasi presensi (20 Nov 2026)
ALTER TABLE "KehadiranEvent" ADD COLUMN "cekLokasi" TEXT;
ALTER TABLE "KehadiranEvent" ADD COLUMN "jarakMeter" INTEGER;

CREATE TABLE "LokasiKantorUnit" (
    "studioId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 200,
    "label" TEXT,
    "diubahOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LokasiKantorUnit_pkey" PRIMARY KEY ("studioId")
);
