// MANIFEST & SOP (Karsa Circle, 27 Nov 2026, desain yang disetujui pemilik).
//   Manifest: semua anggota menulis sendiri di web kerja harian untuk BULAN BERJALAN (WIB); bulan yang sudah lewat terkunci
//   (mulai tanggal 1 bulan berikutnya). Teman satu studio saling membaca. Web pusat merekap per studio (Koordinator ke atas).
//   SOP: per studio. Koordinator/Pendamping unit itu (atau Kepala Circle/RU, Super Admin) menulis; semua anggota studio membaca;
//   web pusat lihat saja.
import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { studioBolehDilihat, peranKerja } from './circle.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (fn) => async (req, res) => { try { await fn(req, res) } catch { gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
export const KATEGORI_SOP = ['ADMIN', 'AKUN', 'ATURAN']
const teks = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null }
export const bulanIniWib = () => { const d = new Date(Date.now() + 7 * 3600000); return { tahun: d.getUTCFullYear(), bulan: d.getUTCMonth() + 1 } }
const batasLabel = ({ tahun, bulan }) => { const n = bulan === 12 ? { t: tahun + 1, b: 1 } : { t: tahun, b: bulan + 1 }; return `${n.t}-${String(n.b).padStart(2, '0')}-01` }
async function anggotaAktif(studioId) {
  const r = await prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { user: { select: { id: true, nama: true } } } })
  const m = new Map(); for (const x of r) m.set(x.user.id, x.user.nama)
  return [...m].map(([id, nama]) => ({ id, nama })).sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}

// ── Web kerja harian ──────────────────────────────────────────────────────────────────────────
// GET /api/circle/manifest?studioId
export const manifestStudio = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  const p = bulanIniWib()
  const tim = await anggotaAktif(studioId)
  const isi = await prisma.manifest.findMany({ where: { ...p, userId: { in: [...tim.map(t => t.id), req.user.id] } } })
  const peta = new Map(isi.map(m => [m.userId, m]))
  return res.json({ success: true, data: { ...p, batas: batasLabel(p), saya: { userId: req.user.id, isi: peta.get(req.user.id)?.isi ?? null, diubah: peta.get(req.user.id)?.updatedAt ?? null },
    tim: tim.filter(t => t.id !== req.user.id).map(t => ({ ...t, isi: peta.get(t.id)?.isi ?? null })), jumlahTim: tim.length, sudah: tim.filter(t => peta.has(t.id)).length } })
})
// PUT /api/circle/manifest { isi } — selalu untuk bulan berjalan
export const tulisManifest = wrap(async (req, res) => {
  const isi = teks(req.body?.isi, 3000); if (!isi) return gagal(res, 422, 'Manifest tidak boleh kosong')
  const p = bulanIniWib()
  await prisma.manifest.upsert({ where: { userId_tahun_bulan: { userId: req.user.id, ...p } }, update: { isi }, create: { userId: req.user.id, ...p, isi } })
  return res.json({ success: true, message: 'Manifest tersimpan' })
})

// GET /api/circle/sop?studioId
export const sopStudio = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!studioId || !(await studioBolehDilihat(req, studioId))) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  const [daftar, boleh, studio] = await Promise.all([
    prisma.sopPanduan.findMany({ where: { studioId }, orderBy: [{ kategori: 'asc' }, { urutan: 'asc' }, { createdAt: 'asc' }] }),
    kelolaStudio(peranKerja(req), studioId),
    prisma.studio.findUnique({ where: { id: studioId }, select: { nama: true } }),
  ])
  return res.json({ success: true, data: { studio: studio?.nama ?? null, daftar, bolehUbah: boleh } })
})
function isiSop(b, lama = {}) {
  const kategori = b.kategori ?? lama.kategori; if (!KATEGORI_SOP.includes(kategori)) return { galat: 'Bagian SOP tidak dikenal' }
  const judul = teks(b.judul ?? lama.judul, 160); if (!judul) return { galat: 'Judul wajib diisi' }
  return { data: { kategori, judul, tag: b.tag !== undefined ? teks(b.tag, 40) : lama.tag ?? null, ket: b.ket !== undefined ? teks(b.ket, 500) : lama.ket ?? null, poin: b.poin !== undefined ? teks(b.poin, 8000) : lama.poin ?? null } }
}
const namaSaya = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null
// POST /api/circle/sop { studioId, kategori, judul, tag?, ket?, poin? }
export const tambahSop = wrap(async (req, res) => {
  const { studioId } = req.body ?? {}
  if (!studioId || !(await kelolaStudio(peranKerja(req), studioId))) return gagal(res, 403, 'SOP hanya ditulis Koordinator studio ini')
  const v = isiSop(req.body); if (v.galat) return gagal(res, 422, v.galat)
  const urutan = await prisma.sopPanduan.count({ where: { studioId, kategori: v.data.kategori } })
  const s = await prisma.sopPanduan.create({ data: { ...v.data, studioId, urutan, olehNama: await namaSaya(req) } })
  return res.status(201).json({ success: true, data: { id: s.id } })
})
// PUT /api/circle/sop/:id
export const ubahSop = wrap(async (req, res) => {
  const s = await prisma.sopPanduan.findUnique({ where: { id: req.params.id } }); if (!s) return gagal(res, 404, 'Panduan tidak ditemukan')
  if (!(await kelolaStudio(peranKerja(req), s.studioId))) return gagal(res, 403, 'SOP hanya diubah Koordinator studio ini')
  const v = isiSop(req.body ?? {}, s); if (v.galat) return gagal(res, 422, v.galat)
  await prisma.sopPanduan.update({ where: { id: s.id }, data: { ...v.data, olehNama: await namaSaya(req) } })
  return res.json({ success: true })
})
// DELETE /api/circle/sop/:id
export const hapusSop = wrap(async (req, res) => {
  const s = await prisma.sopPanduan.findUnique({ where: { id: req.params.id } }); if (!s) return gagal(res, 404, 'Panduan tidak ditemukan')
  if (!(await kelolaStudio(peranKerja(req), s.studioId))) return gagal(res, 403, 'SOP hanya diubah Koordinator studio ini')
  await prisma.sopPanduan.delete({ where: { id: s.id } })
  return res.json({ success: true })
})

// ── Web pusat ─────────────────────────────────────────────────────────────────────────────────
async function studioDikelola(roles) {
  const semua = await prisma.studio.findMany({ where: { statusAktif: true }, select: { id: true, nama: true }, orderBy: { nama: 'asc' } })
  const hasil = []; for (const s of semua) if (await kelolaStudio(roles, s.id)) hasil.push(s)
  return hasil
}
// GET /api/manifest?bulan&tahun — rekap per studio yang dikelola
export const rekapManifest = wrap(async (req, res) => {
  const kini = bulanIniWib()
  const bulan = Number(req.query.bulan) || kini.bulan, tahun = Number(req.query.tahun) || kini.tahun
  const studios = await studioDikelola(req.userRoles ?? [])
  const per = await Promise.all(studios.map(async s => ({ ...s, anggota: await anggotaAktif(s.id) })))
  const ids = [...new Set(per.flatMap(s => s.anggota.map(a => a.id)))]
  const isi = await prisma.manifest.findMany({ where: { bulan, tahun, userId: { in: ids } } })
  const peta = new Map(isi.map(m => [m.userId, m.isi]))
  const diubah = new Map(isi.map(m => [m.userId, m.updatedAt]))
  const sekarang = kini.tahun * 12 + kini.bulan, dilihat = tahun * 12 + bulan
  return res.json({ success: true, data: { bulan, tahun, terkunci: dilihat < sekarang, batas: batasLabel({ tahun, bulan }),
    totalOrang: ids.length, sudahOrang: ids.filter(id => peta.has(id)).length,
    studio: per.map(s => ({ id: s.id, nama: s.nama, anggota: s.anggota.map(a => ({ ...a, isi: peta.get(a.id) ?? null, diubah: diubah.get(a.id) ?? null })) })) } })
})
// GET /api/sop?studioId — lihat saja; tanpa studioId = daftar studio yang dikelola
export const lihatSop = wrap(async (req, res) => {
  const studios = await studioDikelola(req.userRoles ?? [])
  const studioId = req.query.studioId ?? studios[0]?.id
  if (!studioId) return res.json({ success: true, data: { studios, daftar: [] } })
  if (!studios.some(s => s.id === studioId)) return gagal(res, 403, 'Bukan studio dalam wewenangmu')
  const daftar = await prisma.sopPanduan.findMany({ where: { studioId }, orderBy: [{ kategori: 'asc' }, { urutan: 'asc' }, { createdAt: 'asc' }] })
  return res.json({ success: true, data: { studios, studioId, daftar } })
})
