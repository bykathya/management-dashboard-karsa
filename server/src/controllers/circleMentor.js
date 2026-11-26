// MENTOR TANPA AKUN (Karsa Circle, tahap 6, 26 Nov 2026): tiap studio punya mentor berbeda; cukup nama + honor bulanan di Penggajian.
// Uang → hanya pengelola unit (Koordinator ke atas, kelolaStudio). Pemilik unit tidak melihat (gaji per orang tertutup, aturan keras 12).
import prisma from '../prisma.js'
import { studioBolehDilihat, peranKerja } from './circle.js'
import { kelolaStudio } from '../utils/roles.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (isi) => async (req, res) => { try { return await isi(req, res) } catch { return gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const bulanSah = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(b ?? ''))
const namaPengguna = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null

async function boleh(req, res, studioId) {
  if (!studioId || !(await studioBolehDilihat(req, studioId))) { gagal(res, 403, 'Bukan studio dalam wewenangmu'); return false }
  if (!(await kelolaStudio(peranKerja(req), studioId))) { gagal(res, 403, 'Mentor hanya diatur Koordinator unit'); return false }
  return true
}
async function ambil(req, res) {
  const m = await prisma.mentorStudio.findUnique({ where: { id: req.params.id } })
  if (!m || !m.aktif) { gagal(res, 404, 'Mentor tidak ditemukan'); return null }
  return (await boleh(req, res, m.studioId)) ? m : null
}
const rapikan = (b) => {
  const nama = String(b.nama ?? '').trim().slice(0, 100)
  const honor = Number(b.honor)
  if (!nama) return { galat: 'Nama mentor wajib diisi' }
  if (!Number.isFinite(honor) || honor < 0) return { galat: 'Honor tidak boleh negatif' }
  return { data: { nama, honor } }
}

// GET /api/circle/mentor?studioId=…&bulan=YYYY-MM
export const daftar = wrap(async (req, res) => {
  const { studioId, bulan } = req.query
  if (!bulanSah(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (!(await boleh(req, res, studioId))) return
  const m = await prisma.mentorStudio.findMany({ where: { studioId, aktif: true }, orderBy: { nama: 'asc' }, include: { bayar: { where: { bulan } } } })
  return res.json({ success: true, data: { mentor: m.map(x => ({ id: x.id, nama: x.nama, honor: x.honor, dibayar: x.bayar.length > 0, jumlahDibayar: x.bayar[0]?.jumlah ?? null, oleh: x.bayar[0]?.oleh ?? null, pada: x.bayar[0]?.pada ?? null })) } })
})
// POST /api/circle/mentor { studioId, nama, honor }
export const tambah = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!(await boleh(req, res, studioId))) return
  const { galat, data } = rapikan(req.body); if (galat) return gagal(res, 422, galat)
  const m = await prisma.mentorStudio.create({ data: { studioId, ...data } })
  return res.status(201).json({ success: true, data: { id: m.id } })
})
// PATCH /api/circle/mentor/:id { nama, honor }
export const ubah = wrap(async (req, res) => {
  const m = await ambil(req, res); if (!m) return
  const { galat, data } = rapikan({ nama: m.nama, honor: m.honor, ...req.body }); if (galat) return gagal(res, 422, galat)
  await prisma.mentorStudio.update({ where: { id: m.id }, data })
  return res.json({ success: true, message: 'Mentor diperbarui' })
})
// DELETE /api/circle/mentor/:id — disembunyikan; catatan bayar bulan lalu tetap
export const hapus = wrap(async (req, res) => {
  const m = await ambil(req, res); if (!m) return
  await prisma.mentorStudio.update({ where: { id: m.id }, data: { aktif: false } })
  return res.json({ success: true, message: 'Mentor dihapus' })
})
// PUT /api/circle/mentor/:id/bayar { bulan, dibayar } — honor bulan itu dicatat saat ditandai dibayar
export const bayar = wrap(async (req, res) => {
  const m = await ambil(req, res); if (!m) return
  const { bulan } = req.body ?? {}
  if (!bulanSah(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
  if (req.body.dibayar) await prisma.mentorBayar.upsert({ where: { mentorId_bulan: { mentorId: m.id, bulan } }, update: {}, create: { mentorId: m.id, bulan, jumlah: m.honor, oleh: await namaPengguna(req) } })
  else await prisma.mentorBayar.deleteMany({ where: { mentorId: m.id, bulan } })
  return res.json({ success: true, data: { id: m.id, dibayar: !!req.body.dibayar } })
})
