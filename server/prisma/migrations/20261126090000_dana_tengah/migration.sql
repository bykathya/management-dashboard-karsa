-- Dana Tengah (Karsa Circle, 26 Nov 2026): centang setoran bulanan tiap studio ke circle
-- CreateTable
CREATE TABLE "DanaTengahSetor" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "bulan" TEXT NOT NULL,
    "dicentangOleh" TEXT,
    "dicentangPada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DanaTengahSetor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DanaTengahSetor_bulan_idx" ON "DanaTengahSetor"("bulan");

-- CreateIndex
CREATE UNIQUE INDEX "DanaTengahSetor_studioId_bulan_key" ON "DanaTengahSetor"("studioId", "bulan");
