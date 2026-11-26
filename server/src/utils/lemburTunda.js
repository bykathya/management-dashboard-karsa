// LEMBUR DARI TUGAS YANG DITUNDA (22 Nov 2026, "ATURAN LEMBUR 3D ARTIST" — tim; keputusan user: admin MENGUSULKAN nilai,
// keputusan akhir Koordinator). Berlaku per unit lewat PengaturanLembur.lemburDariTunda (diatur Koordinator).
//  • Tugas yang terlambat karena kelalaian talent tetap di Antreanku → bukan lembur.
//  • Tugas yang DITUNDA admin (PenugasanTahap.tunda, ada di Tugasku) lalu diselesaikan talent DI LUAR jam kerja unit (jadwal unit / hari libur)
//    → tercatat sendiri sebagai CALON lembur (LemburKehadiran sumber TUNDA) & kartunya diberi label 🌙 Lembur.
//  • Admin Market / Koordinator menilai: level + tahap yang dicentang (boleh beberapa) → nilai otomatis, boleh disesuaikan → MENUNGGU.
//  • Koordinator mengubah nilai / menyetujui / menolak di Tugas saya › Lembur (jalur tinjauLembur yang sama). Hanya DISETUJUI masuk slip.
import prisma from '../prisma.js'
import { jamResmi } from './kehadiran.js'
import { kunciTanggalWIB } from './jamKerja.js'
import { jadwalUnit } from './jamKerjaUnit.js'

const tanggal = (s) => new Date(s + 'T00:00:00.000Z')

/** Apakah `waktu` di luar jam kerja unit (sebelum masuk, sesudah pulang, hari tanpa jadwal, atau hari libur)? */
export async function luarJamKerja(studioId, waktu = new Date()) {
  const tgl = kunciTanggalWIB(waktu)
  const libur = await prisma.hariLiburKerja.findMany({ where: { tanggal: tanggal(tgl) }, select: { tanggal: true, jenis: true } })
  const hk = new Map(libur.map(b => [b.tanggal.toISOString().slice(0, 10), b.jenis]))
  const jam = jamResmi(tgl, hk, await jadwalUnit(studioId))
  if (!jam) return { luar: true, tgl, keterangan: 'hari libur / tanpa jam kerja' }
  const luar = waktu < jam.mulai || waktu >= jam.selesai
  return { luar, tgl, keterangan: luar ? `di luar jam kerja (${jam.label})` : null }
}

/** Unit ini memakai lembur dari tugas yang ditunda? */
export const unitLemburTunda = async (studioId) => !!(studioId && (await prisma.pengaturanLembur.findUnique({ where: { studioId }, select: { lemburDariTunda: true } }))?.lemburDariTunda)

/** Penugasan DITUNDA yang masih terbuka milik `userId` di tahap order itu (dicari SEBELUM kartu dipindah). */
export const penugasanTundaTerbuka = (orderId, tahapId, userId) => prisma.penugasanTahap.findFirst({
  where: { orderId, tahapId, userId, tunda: true, status: { in: ['MENUNGGU', 'DIKERJAKAN'] } }, orderBy: { ditugaskanPada: 'desc' },
})

/**
 * Catat CALON lembur untuk satu penugasan (sekali per penugasan). `waktu` = saat talent menyelesaikan (Siap QC / lanjut).
 * Dipakai otomatis dari aksi talent, dan oleh admin ("🌙 Tandai lembur") bila talent mengerjakannya malam tetapi baru klik pagi.
 */
export async function catatCalonLembur({ penugasan, order, waktu = new Date(), catatan }) {
  if (!penugasan || !order?.studioId) return null
  const ada = await prisma.lemburKehadiran.findFirst({ where: { penugasanId: penugasan.id }, select: { id: true } })
  if (ada) return null
  const tgl = kunciTanggalWIB(waktu)
  return prisma.lemburKehadiran.create({ data: {
    userId: penugasan.userId, studioId: order.studioId, status: 'CALON', sumber: 'TUNDA', tanggalKerja: tanggal(tgl), mulai: waktu, selesai: waktu, menit: 0,
    orderId: order.id, penugasanId: penugasan.id,
    catatan: (catatan ?? `Tugas ditunda diselesaikan di luar jam kerja — ${penugasan.namaTahap} · ${order.judul ?? ''}`).slice(0, 300),
  } })
}

/** Label 🌙 per order untuk papan/Kurasi QC: Map orderId → 'CALON' | 'MENUNGGU' (lembur dari tugas ditunda yang belum diputuskan). */
export async function labelLemburOrder(orderIds = []) {
  if (!orderIds.length) return new Map()
  const l = await prisma.lemburKehadiran.findMany({ where: { orderId: { in: orderIds }, sumber: 'TUNDA', status: { in: ['CALON', 'MENUNGGU'] } }, select: { orderId: true, status: true } })
  const m = new Map()
  for (const x of l) if (m.get(x.orderId) !== 'CALON') m.set(x.orderId, x.status) // CALON (perlu dinilai admin) lebih penting ditampilkan
  return m
}
