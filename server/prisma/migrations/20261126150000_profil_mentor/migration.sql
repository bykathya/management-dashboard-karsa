-- Profil "Tentang aku" anggota + mentor tanpa akun (Karsa Circle, tahap 6, 26 Nov 2026)
-- CreateTable
CREATE TABLE "ProfilAnggota" (
    "userId" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "bio" TEXT,
    "keahlian" TEXT,
    "zodiak" TEXT,
    "ulangTahun" TEXT,
    "jamAktif" TEXT,
    "status" TEXT,
    "instagram" TEXT,
    "ndaUrl" TEXT,
    "ndaOleh" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilAnggota_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MentorStudio" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "honor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorStudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorBayar" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "jumlah" DOUBLE PRECISION NOT NULL,
    "oleh" TEXT,
    "pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorBayar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorStudio_studioId_aktif_idx" ON "MentorStudio"("studioId", "aktif");

-- CreateIndex
CREATE UNIQUE INDEX "MentorBayar_mentorId_bulan_key" ON "MentorBayar"("mentorId", "bulan");

-- AddForeignKey
ALTER TABLE "MentorBayar" ADD CONSTRAINT "MentorBayar_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "MentorStudio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
