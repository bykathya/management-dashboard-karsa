// HR & DATABASE (Karsa, 28 Nov 2026, desain yang disetujui pemilik): kartu anggota per studio — kontak, kontrak, rekening, dan
// 4 dokumen (KTP, NDA, SKCK/SKBB, buku rekening). Hanya untuk pengelola: seseorang tampil bila penonton mengelola (kelolaStudio)
// salah satu studionya; Kepala Circle/RU tampil di grup Manajemen untuk circle/RU yang sama. Dokumen di folder privat.
import path from 'path'
import { unlink } from 'fs/promises'
import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { dokumenAnggotaDir } from '../middleware/upload.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (fn) => async (req, res) => { try { await fn(req, res) } catch { gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
export const JENIS_DOK = ['KTP', 'NDA', 'SKCK', 'BANK']
const LABEL_PERAN = { ADVISOR: 'Advisor', KEPALA_EKOSISTEM: 'Kepala Ekosistem', KEPALA_CIRCLE: 'Kepala Circle', KEPALA_RUMAH_USAHA: 'Kepala Rumah Usaha', ADMIN_FUNGSIONAL: 'Admin', PENDAMPING: 'Pendamping', KOORDINATOR: 'Koordinator', KADER: 'Kader', KARYAWAN: 'Talent', MAGANG: 'Magang' }
const URUT = Object.keys(LABEL_PERAN)
const tgl = (s) => (s ? new Date(String(s).slice(0, 10) + 'T00:00:00.000Z') : null)
const tglSah = (v) => v === '' || v == null || /^\d{4}-\d{2}-\d{2}$/.test(String(v))
const teks = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null }

async function studioDikelola(roles) {
  const semua = await prisma.studio.findMany({ where: { statusAktif: true }, select: { id: true, nama: true, circleId: true, rumahUsahaId: true }, orderBy: { nama: 'asc' } })
  const hasil = []; for (const s of semua) if (await kelolaStudio(roles, s.id)) hasil.push(s)
  return hasil
}
async function bolehKelolaOrang(roles, userId) {
  const r = await prisma.userRole.findMany({ where: { userId }, select: { studioId: true } })
  for (const x of r) if (x.studioId && (await kelolaStudio(roles, x.studioId))) return true
  return roles.some(x => x.roleType === 'ADVISOR' || x.roleType === 'KEPALA_EKOSISTEM') // atasan seluruh ekosistem
}

// GET /api/hr
export const daftar = wrap(async (req, res) => {
  const studios = await studioDikelola(req.userRoles ?? [])
  const sIds = studios.map(s => s.id), cIds = [...new Set(studios.map(s => s.circleId).filter(Boolean))], ruIds = [...new Set(studios.map(s => s.rumahUsahaId).filter(Boolean))]
  const peran = await prisma.userRole.findMany({
    where: { roleType: { not: 'DIGNITY' }, user: { statusAktif: true }, OR: [{ studioId: { in: sIds } }, { roleType: 'KEPALA_CIRCLE', circleId: { in: cIds } }, { roleType: 'KEPALA_RUMAH_USAHA', rumahUsahaId: { in: ruIds } }] },
    select: { roleType: true, studioId: true, user: { select: { id: true, nama: true, email: true, nomorWa: true, posisi: true, tanggalMasuk: true, namaBank: true, noRekening: true, atasNamaRekening: true } } },
  })
  const orang = new Map()
  for (const r of peran) {
    const x = orang.get(r.user.id) ?? { ...r.user, peranSet: new Set(), studioIds: new Set() }
    x.peranSet.add(r.roleType); if (r.studioId && sIds.includes(r.studioId)) x.studioIds.add(r.studioId); orang.set(r.user.id, x)
  }
  const ids = [...orang.keys()]
  const [sdm, dok, prof] = await Promise.all([
    prisma.profilSdm.findMany({ where: { userId: { in: ids } }, select: { userId: true, kontrakMulai: true, kontrakAkhir: true, catatan: true } }),
    prisma.dokumenAnggota.findMany({ where: { userId: { in: ids } }, select: { id: true, userId: true, jenis: true, mime: true, createdAt: true } }),
    prisma.profilAnggota.findMany({ where: { userId: { in: ids } }, select: { userId: true, fotoUrl: true, ndaUrl: true } }),
  ])
  const sdmM = new Map(sdm.map(x => [x.userId, x])), profM = new Map(prof.map(x => [x.userId, x]))
  const data = [...orang.values()].map(x => {
    const per = [...x.peranSet].sort((a, b) => URUT.indexOf(a) - URUT.indexOf(b)), s = sdmM.get(x.id), p = profM.get(x.id)
    return {
      id: x.id, nama: x.nama, email: x.email, nomorWa: x.nomorWa, posisi: x.posisi, tanggalMasuk: x.tanggalMasuk,
      peran: LABEL_PERAN[per[0]] ?? 'Anggota', peranTipe: per[0], manajemen: per.some(r => ['ADVISOR', 'KEPALA_EKOSISTEM', 'KEPALA_CIRCLE', 'KEPALA_RUMAH_USAHA'].includes(r)),
      studioIds: [...x.studioIds], fotoUrl: p?.fotoUrl ?? null, ndaUrl: p?.ndaUrl ?? null,
      kontrakMulai: s?.kontrakMulai ?? null, kontrakAkhir: s?.kontrakAkhir ?? null, catatan: s?.catatan ?? null,
      namaBank: x.namaBank, noRekening: x.noRekening, atasNamaRekening: x.atasNamaRekening,
      dokumen: Object.fromEntries(JENIS_DOK.map(j => [j, dok.find(d => d.userId === x.id && d.jenis === j) ?? null])),
    }
  }).sort((a, b) => URUT.indexOf(a.peranTipe) - URUT.indexOf(b.peranTipe) || a.nama.localeCompare(b.nama, 'id'))
  return res.json({ success: true, data: { studios: studios.map(s => ({ id: s.id, nama: s.nama })), orang: data, jenisDokumen: JENIS_DOK } })
})

// PUT /api/hr/:userId { nomorWa?, kontrakMulai?, kontrakAkhir?, namaBank?, noRekening?, atasNamaRekening?, catatan? }
export const ubah = wrap(async (req, res) => {
  const { userId } = req.params
  if (!(await bolehKelolaOrang(req.userRoles ?? [], userId))) return gagal(res, 403, 'Bukan anggota studio yang kamu kelola')
  const b = req.body ?? {}, user = {}, sdm = {}
  if (b.nomorWa !== undefined) { const v = teks(b.nomorWa, 30); if (v && !/^[+0-9 ()-]{6,30}$/.test(v)) return gagal(res, 422, 'Nomor WhatsApp tidak sah'); user.nomorWa = v }
  for (const k of ['namaBank', 'atasNamaRekening']) if (b[k] !== undefined) user[k] = teks(b[k], 120)
  if (b.noRekening !== undefined) { const v = teks(b.noRekening, 40); if (v && !/^[0-9 -]{4,40}$/.test(v)) return gagal(res, 422, 'Nomor rekening hanya angka'); user.noRekening = v }
  for (const k of ['kontrakMulai', 'kontrakAkhir']) if (b[k] !== undefined) { if (!tglSah(b[k])) return gagal(res, 422, 'Tanggal kontrak tidak sah'); sdm[k] = tgl(b[k]) }
  if (b.catatan !== undefined) sdm.catatan = teks(b.catatan, 1000)
  if (sdm.kontrakMulai && sdm.kontrakAkhir && sdm.kontrakAkhir < sdm.kontrakMulai) return gagal(res, 422, 'Kontrak berakhir sebelum mulai')
  if (Object.keys(user).length) await prisma.user.update({ where: { id: userId }, data: user })
  if (Object.keys(sdm).length) await prisma.profilSdm.upsert({ where: { userId }, update: { ...sdm, diubahOlehId: req.user.id }, create: { userId, ...sdm, diubahOlehId: req.user.id } })
  return res.json({ success: true, message: 'Tersimpan' })
})

// POST /api/hr/:userId/dokumen (multipart: jenis, berkas) — mengganti dokumen lama jenis itu
export const unggahDokumen = wrap(async (req, res) => {
  const f = req.file, buang = () => (f ? unlink(f.path).catch(() => {}) : null)
  const { userId } = req.params, jenis = req.body?.jenis
  if (!f) return gagal(res, 422, 'Pilih berkas dulu')
  if (!JENIS_DOK.includes(jenis)) { await buang(); return gagal(res, 422, 'Jenis dokumen tidak dikenal') }
  if (!(await bolehKelolaOrang(req.userRoles ?? [], userId))) { await buang(); return gagal(res, 403, 'Bukan anggota studio yang kamu kelola') }
  const lama = await prisma.dokumenAnggota.findUnique({ where: { userId_jenis: { userId, jenis } } })
  await prisma.dokumenAnggota.upsert({ where: { userId_jenis: { userId, jenis } }, update: { berkas: f.filename, mime: f.mimetype, ukuran: f.size, olehId: req.user.id, createdAt: new Date() }, create: { userId, jenis, berkas: f.filename, mime: f.mimetype, ukuran: f.size, olehId: req.user.id } })
  if (lama) await unlink(path.join(dokumenAnggotaDir, path.basename(lama.berkas))).catch(() => {})
  return res.status(201).json({ success: true, message: 'Dokumen tersimpan' })
})
// GET /api/hr/dokumen/:id
export const lihatDokumen = wrap(async (req, res) => {
  const d = await prisma.dokumenAnggota.findUnique({ where: { id: req.params.id } }); if (!d) return gagal(res, 404, 'Dokumen tidak ditemukan')
  if (!(await bolehKelolaOrang(req.userRoles ?? [], d.userId))) return gagal(res, 403, 'Bukan anggota studio yang kamu kelola')
  res.setHeader('Content-Type', d.mime); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.sendFile(path.join(dokumenAnggotaDir, path.basename(d.berkas)))
})
// DELETE /api/hr/dokumen/:id
export const hapusDokumen = wrap(async (req, res) => {
  const d = await prisma.dokumenAnggota.findUnique({ where: { id: req.params.id } }); if (!d) return gagal(res, 404, 'Dokumen tidak ditemukan')
  if (!(await bolehKelolaOrang(req.userRoles ?? [], d.userId))) return gagal(res, 403, 'Bukan anggota studio yang kamu kelola')
  await unlink(path.join(dokumenAnggotaDir, path.basename(d.berkas))).catch(() => {})
  await prisma.dokumenAnggota.delete({ where: { id: d.id } })
  return res.json({ success: true })
})
