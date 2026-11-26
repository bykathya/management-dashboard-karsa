// JADWAL RUTIN ARUS KAS (Karsa Circle, tahap 5, 26 Nov 2026): daftar hal yang rutin dikerjakan tiap bulan per studio, dicentang per bulan.
// Bagian dari Arus Kas = keuangan unit → hanya pengelola unit (Koordinator/Pendamping ke atas, kelolaStudio); pemilik unit boleh melihat saja.
// Admin Market tidak termasuk (aturan keras 8: Admin Market bukan pengelola keuangan unit).
import prisma from '../prisma.js'
import { studioBolehDilihat, peranStudio } from './circle.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const bulanSah = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(b ?? ''))
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null

async function akses(req, res, studioId, { tulis = false } = {}) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return null }
  const p = await peranStudio(req, studioId)
  const boleh = p.pengelola || (p.lihatSaja && !tulis)
  if (!boleh) { gagal(res, 403, tulis ? 'Hanya Koordinator unit yang bisa mengubah jadwal' : 'Jadwal Arus Kas hanya untuk Koordinator unit'); return null }
  return p
}

// GET /api/circle/jadwal?studioId=…&bulan=YYYY-MM
export const daftar = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!bulanSah(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  const p = await akses(req, res, studioId); if (!p) return
  const item = await prisma.jadwalRutin.findMany({
    where: { studioId, aktif: true }, orderBy: [{ hari: 'asc' }, { createdAt: 'asc' }],
    include: { centang: { where: { bulan }, select: { oleh: true, pada: true } } },
  })
  return res.json({ success: true, data: {
    bulan, bisaUbah: !!p.pengelola,
    item: item.map(i => ({ id: i.id, hari: i.hari, tugas: i.tugas, selesai: i.centang.length > 0, oleh: i.centang[0]?.oleh ?? null, pada: i.centang[0]?.pada ?? null })),
  } })
})

// POST /api/circle/jadwal { studioId, hari, tugas }
export const tambah = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await akses(req, res, studioId, { tulis: true }))) return
  const hari = Number(req.body.hari)
  if (!Number.isInteger(hari) || hari < 1 || hari > 31) return gagal(res, 422, 'Tanggal harus 1–31')
  const tugas = String(req.body.tugas ?? '').trim().slice(0, 200)
  if (!tugas) return gagal(res, 422, 'Tulis apa yang harus dikerjakan')
  const x = await prisma.jadwalRutin.create({ data: { studioId, hari, tugas, dibuatOleh: await namaPengguna(req) } })
  return res.status(201).json({ success: true, data: { id: x.id } })
})

async function ambil(req, res) {
  const x = await prisma.jadwalRutin.findUnique({ where: { id: req.params.id } })
  if (!x || !x.aktif) { gagal(res, 404, 'Jadwal tidak ditemukan'); return null }
  if (!(await akses(req, res, x.studioId, { tulis: true }))) return null
  return x
}

// DELETE /api/circle/jadwal/:id — disembunyikan (aktif = false); centang bulan lalu tetap tersimpan
export const hapus = wrap(async (req, res) => {
  const x = await ambil(req, res); if (!x) return
  await prisma.jadwalRutin.update({ where: { id: x.id }, data: { aktif: false } })
  return res.json({ success: true, message: 'Jadwal dihapus' })
})

// PUT /api/circle/jadwal/:id/centang { bulan, selesai: true|false }
export const centang = wrap(async (req, res) => {
  const x = await ambil(req, res); if (!x) return
  const { bulan } = req.body ?? {}
  if (!bulanSah(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (req.body.selesai) await prisma.jadwalCentang.upsert({ where: { jadwalId_bulan: { jadwalId: x.id, bulan } }, update: {}, create: { jadwalId: x.id, bulan, oleh: await namaPengguna(req) } })
  else await prisma.jadwalCentang.deleteMany({ where: { jadwalId: x.id, bulan } })
  return res.json({ success: true, data: { id: x.id, selesai: !!req.body.selesai } })
})
