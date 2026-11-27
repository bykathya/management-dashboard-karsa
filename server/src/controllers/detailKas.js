// DETAIL KAS + EKUITAS (Karsa, 27 Nov 2026, desain yang disetujui pemilik): semua tempat uang studio + screenshot saldonya.
//   • Rekening bank = StudioRekening (kas resmi, aturan "satu sumber kas"): saldo diubah di sini → laporan minggu berjalan ikut diselaraskan.
//   • Pos lain (marketplace, dalam perjalanan, dana pengamanan) = PosKas; jumlahnya ditulis ke StudioMonthlyNote.ekuitas bulan berjalan
//     ("Dana di luar kas"), sehingga Overview & Runway membaca angka yang sama.
//   • Bukti screenshot di folder privat; hanya dibuka lewat API ini.
//   • Akses: pengelola unit (Koordinator/Pendamping unit, Kepala Circle/RU pemiliknya, Super Admin). Centang VALID: Kepala Circle/RU atau
//     Super Admin saja; mengubah nominal mengembalikan status ke belum valid.
import path from 'path'
import { unlink } from 'fs/promises'
import prisma from '../prisma.js'
import { kelolaStudio, atasanStudio } from '../utils/roles.js'
import { snapshotKasMingguIni } from '../utils/kas.js'
import { buktiKasDir } from '../middleware/upload.js'
import { KURS_BAWAAN } from '../utils/uang.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (fn) => async (req, res) => { try { await fn(req, res) } catch { gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
export const JENIS_POS = ['MARKET', 'TRANSIT', 'AMAN']
const MAKS_BUKTI = 10
const teks = (v, n) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n))
const uang = (v) => { const n = Number(v ?? 0); return Number.isFinite(n) && n >= 0 && n <= 1e13 ? n : undefined }

async function izin(req, res, studioId) {
  if (!studioId || !(await kelolaStudio(req.userRoles ?? [], studioId))) { gagal(res, 403, 'Detail kas hanya untuk pengelola unit ini'); return false }
  return true
}
async function kursTerakhir(studioId) {
  const r = await prisma.weeklyReport.findFirst({ where: { studioId }, orderBy: { periodeAwal: 'desc' }, select: { kurs: true } })
  return r?.kurs > 0 ? r.kurs : KURS_BAWAAN
}
const bulanIniWIB = () => { const d = new Date(Date.now() + 7 * 3600000); return { bulan: d.getUTCMonth() + 1, tahun: d.getUTCFullYear() } }
// Jumlah pos non-bank → Dana di luar kas bulan berjalan
async function sinkronEkuitas(studioId) {
  const [pos, kurs] = await Promise.all([prisma.posKas.findMany({ where: { studioId } }), kursTerakhir(studioId)])
  const ekuitas = Math.round(pos.reduce((s, p) => s + p.rupiah + p.dolar * kurs, 0))
  const { bulan, tahun } = bulanIniWIB()
  await prisma.studioMonthlyNote.upsert({ where: { studioId_bulan_tahun: { studioId, bulan, tahun } }, update: { ekuitas }, create: { studioId, bulan, tahun, ekuitas } })
}
const namaSaya = async (req) => (await prisma.user.findUnique({ where: { id: req.user.id }, select: { nama: true } }))?.nama ?? null

// GET /api/kas-detail?studioId=
export const muat = wrap(async (req, res) => {
  const { studioId } = req.query
  if (!(await izin(req, res, studioId))) return
  const [rekening, pos, bukti, kurs, bolehValidasi, studio] = await Promise.all([
    prisma.studioRekening.findMany({ where: { studioId }, orderBy: { createdAt: 'asc' } }),
    prisma.posKas.findMany({ where: { studioId }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] }),
    prisma.buktiKas.findMany({ where: { studioId }, orderBy: { createdAt: 'asc' }, select: { id: true, rekeningId: true, posId: true, mime: true, ukuran: true, createdAt: true } }),
    kursTerakhir(studioId),
    atasanStudio(req.userRoles ?? [], studioId),
    prisma.studio.findUnique({ where: { id: studioId }, select: { nama: true } }),
  ])
  return res.json({ success: true, data: { studio: studio?.nama ?? null, kurs, bolehValidasi, jenisPos: JENIS_POS,
    rekening: rekening.map(r => ({ ...r, bukti: bukti.filter(b => b.rekeningId === r.id) })),
    pos: pos.map(p => ({ ...p, bukti: bukti.filter(b => b.posId === p.id) })) } })
})

// POST /api/kas-detail/rekening { studioId, namaBank, nomorRekening?, atasNama?, saldo, catatan? }
export const tambahRekening = wrap(async (req, res) => {
  const { studioId } = req.body
  if (!(await izin(req, res, studioId))) return
  const namaBank = teks(req.body.namaBank, 80); if (!namaBank) return gagal(res, 422, 'Nama bank wajib diisi')
  const saldo = uang(req.body.saldo); if (saldo === undefined) return gagal(res, 422, 'Saldo harus angka 0 ke atas')
  const r = await prisma.studioRekening.create({ data: { studioId, namaBank, nomorRekening: teks(req.body.nomorRekening, 40) ?? '-', atasNama: teks(req.body.atasNama, 120) ?? '-', saldo, catatan: teks(req.body.catatan, 300) } })
  await snapshotKasMingguIni(studioId).catch(() => {})
  return res.status(201).json({ success: true, data: { id: r.id } })
})
// PUT /api/kas-detail/rekening/:id { namaBank?, atasNama?, saldo?, catatan? }
export const ubahRekening = wrap(async (req, res) => {
  const r = await prisma.studioRekening.findUnique({ where: { id: req.params.id } }); if (!r) return gagal(res, 404, 'Rekening tidak ditemukan')
  if (!(await izin(req, res, r.studioId))) return
  const data = {}
  if (req.body.namaBank !== undefined) { const v = teks(req.body.namaBank, 80); if (!v) return gagal(res, 422, 'Nama bank wajib diisi'); data.namaBank = v }
  if (req.body.atasNama !== undefined) data.atasNama = teks(req.body.atasNama, 120) ?? '-'
  if (req.body.catatan !== undefined) data.catatan = teks(req.body.catatan, 300)
  if (req.body.saldo !== undefined) { const v = uang(req.body.saldo); if (v === undefined) return gagal(res, 422, 'Saldo harus angka 0 ke atas'); if (v !== r.saldo) Object.assign(data, { saldo: v, valid: false, validOleh: null, validPada: null }) }
  await prisma.studioRekening.update({ where: { id: r.id }, data })
  if (data.saldo !== undefined) await snapshotKasMingguIni(r.studioId).catch(() => {})
  return res.json({ success: true, data: { id: r.id } })
})

function isiPos(body, lama = {}) {
  const jenis = body.jenis ?? lama.jenis; if (!JENIS_POS.includes(jenis)) return { galat: 'Jenis pos tidak dikenal' }
  const nama = teks(body.nama ?? lama.nama, 80); if (!nama) return { galat: 'Nama pos wajib diisi' }
  const rupiah = uang(body.rupiah ?? lama.rupiah ?? 0), dolar = uang(body.dolar ?? lama.dolar ?? 0)
  if (rupiah === undefined || dolar === undefined) return { galat: 'Nominal harus angka 0 ke atas' }
  return { data: { jenis, nama, rupiah, dolar, atasNama: body.atasNama !== undefined ? teks(body.atasNama, 120) : lama.atasNama ?? null, catatan: body.catatan !== undefined ? teks(body.catatan, 300) : lama.catatan ?? null } }
}
// POST /api/kas-detail/pos { studioId, jenis, nama, rupiah?, dolar?, atasNama?, catatan? }
export const tambahPos = wrap(async (req, res) => {
  const { studioId } = req.body
  if (!(await izin(req, res, studioId))) return
  const v = isiPos(req.body); if (v.galat) return gagal(res, 422, v.galat)
  const urutan = await prisma.posKas.count({ where: { studioId } })
  const p = await prisma.posKas.create({ data: { ...v.data, studioId, urutan } })
  await sinkronEkuitas(studioId)
  return res.status(201).json({ success: true, data: { id: p.id } })
})
// PUT /api/kas-detail/pos/:id
export const ubahPos = wrap(async (req, res) => {
  const p = await prisma.posKas.findUnique({ where: { id: req.params.id } }); if (!p) return gagal(res, 404, 'Pos tidak ditemukan')
  if (!(await izin(req, res, p.studioId))) return
  const v = isiPos(req.body, p); if (v.galat) return gagal(res, 422, v.galat)
  const berubah = v.data.rupiah !== p.rupiah || v.data.dolar !== p.dolar
  await prisma.posKas.update({ where: { id: p.id }, data: { ...v.data, ...(berubah ? { valid: false, validOleh: null, validPada: null } : {}) } })
  if (berubah) await sinkronEkuitas(p.studioId)
  return res.json({ success: true, data: { id: p.id } })
})
async function hapusBerkas(where) {
  const daftar = await prisma.buktiKas.findMany({ where, select: { id: true, berkas: true } })
  for (const b of daftar) await unlink(path.join(buktiKasDir, path.basename(b.berkas))).catch(() => {})
  await prisma.buktiKas.deleteMany({ where: { id: { in: daftar.map(b => b.id) } } })
}
// DELETE /api/kas-detail/pos/:id
export const hapusPos = wrap(async (req, res) => {
  const p = await prisma.posKas.findUnique({ where: { id: req.params.id } }); if (!p) return gagal(res, 404, 'Pos tidak ditemukan')
  if (!(await izin(req, res, p.studioId))) return
  await hapusBerkas({ posId: p.id })
  await prisma.posKas.delete({ where: { id: p.id } })
  await sinkronEkuitas(p.studioId)
  return res.json({ success: true, data: { id: p.id } })
})

// PUT /api/kas-detail/valid { jenis: 'rekening'|'pos', id, valid } — Kepala Circle/RU atau Super Admin
export const aturValid = wrap(async (req, res) => {
  const { jenis, id } = req.body
  const tabel = jenis === 'rekening' ? prisma.studioRekening : jenis === 'pos' ? prisma.posKas : null
  if (!tabel) return gagal(res, 422, 'Jenis harus rekening atau pos')
  const x = await tabel.findUnique({ where: { id: String(id) } }); if (!x) return gagal(res, 404, 'Data tidak ditemukan')
  if (!(await atasanStudio(req.userRoles ?? [], x.studioId))) return gagal(res, 403, 'Centang Valid hanya untuk Kepala Circle atau Super Admin')
  const valid = !!req.body.valid
  await tabel.update({ where: { id: x.id }, data: { valid, validOleh: valid ? await namaSaya(req) : null, validPada: valid ? new Date() : null } })
  return res.json({ success: true, data: { id: x.id, valid } })
})

// POST /api/kas-detail/bukti (multipart: studioId, rekeningId | posId, berkas[])
export const unggahBukti = wrap(async (req, res) => {
  const files = req.files ?? []
  const buang = () => Promise.all(files.map(f => unlink(f.path).catch(() => {})))
  const { studioId, rekeningId, posId } = req.body
  if (!files.length) return gagal(res, 422, 'Pilih gambar dulu')
  if (!(await kelolaStudio(req.userRoles ?? [], studioId))) { await buang(); return gagal(res, 403, 'Detail kas hanya untuk pengelola unit ini') }
  const pemilik = rekeningId ? await prisma.studioRekening.findFirst({ where: { id: String(rekeningId), studioId } }) : posId ? await prisma.posKas.findFirst({ where: { id: String(posId), studioId } }) : null
  if (!pemilik) { await buang(); return gagal(res, 422, 'Rekening/pos tidak ditemukan di unit ini') }
  const ada = await prisma.buktiKas.count({ where: rekeningId ? { rekeningId: pemilik.id } : { posId: pemilik.id } })
  if (ada + files.length > MAKS_BUKTI) { await buang(); return gagal(res, 422, `Maksimal ${MAKS_BUKTI} screenshot per pos`) }
  await prisma.buktiKas.createMany({ data: files.map(f => ({ studioId, rekeningId: rekeningId ? pemilik.id : null, posId: posId ? pemilik.id : null, berkas: f.filename, mime: f.mimetype, ukuran: f.size, olehId: req.user.id })) })
  return res.status(201).json({ success: true, message: `${files.length} screenshot tersimpan` })
})
// GET /api/kas-detail/bukti/:id — gambar, hanya untuk pengelola unit
export const lihatBukti = wrap(async (req, res) => {
  const b = await prisma.buktiKas.findUnique({ where: { id: req.params.id } }); if (!b) return gagal(res, 404, 'Bukti tidak ditemukan')
  if (!(await izin(req, res, b.studioId))) return
  res.setHeader('Content-Type', b.mime); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
  return res.sendFile(path.join(buktiKasDir, path.basename(b.berkas)))
})
// DELETE /api/kas-detail/bukti/:id
export const hapusBukti = wrap(async (req, res) => {
  const b = await prisma.buktiKas.findUnique({ where: { id: req.params.id } }); if (!b) return gagal(res, 404, 'Bukti tidak ditemukan')
  if (!(await izin(req, res, b.studioId))) return
  await hapusBerkas({ id: b.id })
  return res.json({ success: true, data: { id: b.id } })
})
