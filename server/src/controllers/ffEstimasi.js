// FINANCIAL FORECASTING baru (Karsa, 27 Nov 2026, desain yang disetujui pemilik): estimasi pengeluaran bulanan per studio.
// Kategori → pos (nominal Rp + Lunas/Belum). Kategori "Tim Internal & Tunjangan" berisi pos per orang yang disinkronkan dari HR.
// Total bulan itu menjadi CPM di Overview & Runway (utils/cpm.js totalFfStudios). Ikut ditampilkan: Kas + Ekuitas (Detail Kas)
// dan omset per akun W1–W4 dari Daily Sheet.
// Akses (keputusan pemilik): Koordinator unit itu, Kepala Circle/Rumah Usaha pemiliknya, Super Admin — BUKAN Admin/Pendamping.
import prisma from '../prisma.js'
import { atasanStudio } from '../utils/roles.js'
import { ORDER_KLIEN } from '../utils/produksi.js'
import { KURS_BAWAAN } from '../utils/uang.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (fn) => async (req, res) => { try { await fn(req, res) } catch { gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
export const POS_ORANG = ['Gaji', 'Komisi', 'Bonus', 'Makan', 'Transport', 'Komunikasi']
const TEMPLAT = [
  { nama: 'Tim Internal & Tunjangan', jenis: 'TIM', item: [] },
  { nama: 'Operasional Studio', item: ['Internet', 'Listrik', 'Sewa tempat'] },
  { nama: 'Langganan & Tools', item: ['Adobe / Clip Studio', 'Google Workspace', 'Biaya transfer & kurs'] },
  { nama: 'Mentor', mentor: true },
  { nama: 'Tabungan & Dana', item: ['Dana darurat', 'Tabungan Hari Raya'] },
]
// Gaji mentor (permintaan Kepala Circle 28 Nov 2026): diambil dari daftar mentor studio (Penggajian web kerja); kalau belum ada, satu pos kosong.
async function posMentor(studioId) {
  const m = await prisma.mentorStudio.findMany({ where: { studioId, aktif: true }, orderBy: { createdAt: 'asc' }, select: { nama: true, honor: true } })
  return m.length ? m.map(x => ({ nama: `Gaji Mentor · ${x.nama}`.slice(0, 80), rupiah: x.honor ?? 0 })) : [{ nama: 'Gaji Mentor', rupiah: 0 }]
}
const teks = (v, n) => String(v ?? '').trim().slice(0, n)

export async function bolehFf(roles = [], studioId) {
  if (!studioId) return false
  if (await atasanStudio(roles, studioId)) return true
  return roles.some(r => r.roleType === 'KOORDINATOR' && r.studioId === studioId)
}
async function izin(req, res, studioId) {
  if (!(await bolehFf(req.userRoles ?? [], studioId))) { gagal(res, 403, 'Financial Forecasting hanya untuk Koordinator dan Kepala Circle'); return false }
  return true
}
const periode = (q) => { const bulan = Number(q.bulan), tahun = Number(q.tahun); return bulan >= 1 && bulan <= 12 && tahun >= 2024 && tahun <= 2100 ? { bulan, tahun } : null }

async function anggotaHr(studioId) {
  const rows = await prisma.userRole.findMany({ where: { studioId, roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { takeHomePay: true, user: { select: { id: true, nama: true } } }, orderBy: { takeHomePay: { sort: 'desc', nulls: 'last' } } })
  const m = new Map(); for (const r of rows) if (!m.has(r.user.id)) m.set(r.user.id, { id: r.user.id, nama: r.user.nama, thp: r.takeHomePay ?? 0 })
  return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
}
// Tambah sub per orang yang belum ada di kategori TIM (orang baru otomatis ditambahkan; yang sudah ada tidak diubah)
async function sinkronTim(kategori, studioId, p) {
  const [orang, ada] = await Promise.all([anggotaHr(studioId), prisma.ffItem.findMany({ where: { kategoriId: kategori.id }, select: { userId: true } })])
  const sudah = new Set(ada.map(x => x.userId).filter(Boolean))
  let urutan = ada.length, baru = 0
  for (const o of orang) {
    if (sudah.has(o.id)) continue
    await prisma.ffItem.createMany({ data: POS_ORANG.map(nama => ({ kategoriId: kategori.id, studioId, ...p, userId: o.id, nama, rupiah: nama === 'Gaji' ? o.thp : 0, urutan: urutan++ })) })
    baru++
  }
  return baru
}

// GET /api/ff?studioId&bulan&tahun
export const muat = wrap(async (req, res) => {
  const { studioId } = req.query, p = periode(req.query)
  if (!p) return gagal(res, 422, 'bulan & tahun wajib')
  if (!(await izin(req, res, studioId))) return
  const awal = new Date(`${p.tahun}-${String(p.bulan).padStart(2, '0')}-01T00:00:00+07:00`)
  const akhir = new Date(`${p.bulan === 12 ? p.tahun + 1 : p.tahun}-${String(p.bulan === 12 ? 1 : p.bulan + 1).padStart(2, '0')}-01T00:00:00+07:00`)
  const sebelum = p.bulan === 1 ? { bulan: 12, tahun: p.tahun - 1 } : { bulan: p.bulan - 1, tahun: p.tahun }
  const [studio, kategori, orang, rekening, pos, kursLap, akun, orders, adaSebelum] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nama: true } }),
    prisma.ffKategori.findMany({ where: { studioId, ...p }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }], include: { item: { orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] } } }),
    anggotaHr(studioId),
    prisma.studioRekening.findMany({ where: { studioId }, select: { saldo: true, valid: true } }),
    prisma.posKas.findMany({ where: { studioId }, select: { rupiah: true, dolar: true, valid: true } }),
    prisma.weeklyReport.findFirst({ where: { studioId }, orderBy: { periodeAwal: 'desc' }, select: { kurs: true } }),
    prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: 'Order Internal' } }, select: { id: true, namaAkun: true, platform: true }, orderBy: { namaAkun: 'asc' } }),
    prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId, status: { not: 'BATAL' }, tanggalMasuk: { gte: awal, lt: akhir } }, select: { akunId: true, tanggalMasuk: true, nilaiKotor: true, nilaiUsd: true, kurs: true, statusBayar: true, partialUsd: true, tipUsd: true } }),
    prisma.ffKategori.count({ where: { studioId, ...sebelum } }),
  ])
  const kurs = kursLap?.kurs > 0 ? kursLap.kurs : KURS_BAWAAN
  const namaOrang = new Map(orang.map(o => [o.id, o.nama]))
  const kas = rekening.reduce((s, r) => s + r.saldo, 0), ekuitas = pos.reduce((s, x) => s + x.rupiah + x.dolar * kurs, 0)
  const semuaPos = [...rekening, ...pos]
  // Omset per akun per minggu (W1 = tgl 1–7, W2 = 8–14, W3 = 15–21, W4 = 22–akhir), uang masuk seperti Daily Sheet
  const tglWib = (d) => Number(new Date(new Date(d).getTime() + 7 * 3600000).toISOString().slice(8, 10))
  const masuk = (o) => (o.statusBayar === 'LUNAS' ? (o.nilaiUsd ?? o.nilaiKotor / (o.kurs > 0 ? o.kurs : kurs)) : (o.partialUsd ?? 0)) + (o.tipUsd ?? 0)
  const omset = akun.map(a => {
    const w = [0, 0, 0, 0]
    for (const o of orders) if (o.akunId === a.id) w[Math.min(3, Math.floor((tglWib(o.tanggalMasuk) - 1) / 7))] += masuk(o)
    return { akunId: a.id, nama: a.namaAkun, platform: a.platform, minggu: w.map(x => Math.round(x * 100) / 100), totalUsd: Math.round(w.reduce((s, x) => s + x, 0) * 100) / 100 }
  })
  return res.json({ success: true, data: {
    studio: studio?.nama ?? null, ...p, kurs, adaSebelum: adaSebelum > 0, posOrang: POS_ORANG,
    kategori: kategori.map(k => ({ ...k, item: k.item.map(i => ({ ...i, namaOrang: i.userId ? (namaOrang.get(i.userId) ?? 'Bukan anggota lagi') : null })) })),
    kas: { kas: Math.round(kas), ekuitas: Math.round(ekuitas), total: Math.round(kas + ekuitas), validPersen: semuaPos.length ? Math.round((semuaPos.filter(x => x.valid).length / semuaPos.length) * 100) : 0 },
    omset,
  } })
})

// POST /api/ff/mulai { studioId, bulan, tahun, dari: 'templat' | 'salin' }
export const mulai = wrap(async (req, res) => {
  const { studioId } = req.body, p = periode(req.body)
  if (!p) return gagal(res, 422, 'bulan & tahun wajib')
  if (!(await izin(req, res, studioId))) return
  if (await prisma.ffKategori.count({ where: { studioId, ...p } })) return gagal(res, 409, 'Estimasi bulan ini sudah ada')
  if (req.body.dari === 'salin') {
    const sebelum = p.bulan === 1 ? { bulan: 12, tahun: p.tahun - 1 } : { bulan: p.bulan - 1, tahun: p.tahun }
    const lama = await prisma.ffKategori.findMany({ where: { studioId, ...sebelum }, include: { item: true }, orderBy: { urutan: 'asc' } })
    if (!lama.length) return gagal(res, 422, 'Bulan lalu belum punya estimasi')
    for (const k of lama) {
      const baru = await prisma.ffKategori.create({ data: { studioId, ...p, nama: k.nama, jenis: k.jenis, urutan: k.urutan } })
      if (k.item.length) await prisma.ffItem.createMany({ data: k.item.map(i => ({ kategoriId: baru.id, studioId, ...p, userId: i.userId, nama: i.nama, rupiah: i.rupiah, lunas: false, urutan: i.urutan })) })
    }
    return res.status(201).json({ success: true, message: 'Disalin dari bulan lalu (status Lunas dikosongkan)' })
  }
  for (const [u, t] of TEMPLAT.entries()) {
    const k = await prisma.ffKategori.create({ data: { studioId, ...p, nama: t.nama, jenis: t.jenis ?? 'BIASA', urutan: u } })
    if (t.jenis === 'TIM') await sinkronTim(k, studioId, p)
    else if (t.mentor) await prisma.ffItem.createMany({ data: (await posMentor(studioId)).map((x, i) => ({ kategoriId: k.id, studioId, ...p, ...x, urutan: i })) })
    else await prisma.ffItem.createMany({ data: t.item.map((nama, i) => ({ kategoriId: k.id, studioId, ...p, nama, urutan: i })) })
  }
  return res.status(201).json({ success: true, message: 'Estimasi dibuat' })
})

async function ambilKategori(req, res, id) {
  const k = await prisma.ffKategori.findUnique({ where: { id } }); if (!k) { gagal(res, 404, 'Kategori tidak ditemukan'); return null }
  return (await izin(req, res, k.studioId)) ? k : null
}
async function ambilItem(req, res, id) {
  const i = await prisma.ffItem.findUnique({ where: { id } }); if (!i) { gagal(res, 404, 'Pos tidak ditemukan'); return null }
  return (await izin(req, res, i.studioId)) ? i : null
}

// POST /api/ff/kategori/:id/sync-hr
export const syncHr = wrap(async (req, res) => {
  const k = await ambilKategori(req, res, req.params.id); if (!k) return
  if (k.jenis !== 'TIM') return gagal(res, 422, 'Hanya kategori tim')
  const baru = await sinkronTim(k, k.studioId, { bulan: k.bulan, tahun: k.tahun })
  return res.json({ success: true, message: baru ? `${baru} orang baru ditambahkan dari HR` : 'Semua anggota sudah ada' })
})
// POST /api/ff/kategori { studioId, bulan, tahun, nama }
export const tambahKategori = wrap(async (req, res) => {
  const { studioId } = req.body, p = periode(req.body)
  if (!p) return gagal(res, 422, 'bulan & tahun wajib')
  if (!(await izin(req, res, studioId))) return
  const nama = teks(req.body.nama, 80); if (!nama) return gagal(res, 422, 'Nama kategori wajib diisi')
  const urutan = await prisma.ffKategori.count({ where: { studioId, ...p } })
  const k = await prisma.ffKategori.create({ data: { studioId, ...p, nama, urutan } })
  await prisma.ffItem.create({ data: { kategoriId: k.id, studioId, ...p, nama: 'Pos baru' } })
  return res.status(201).json({ success: true, data: { id: k.id } })
})
// POST /api/ff/mentor { studioId, bulan, tahun }: tambah kategori Mentor (atau pos mentor yang belum ada) ke estimasi bulan ini
export const tambahMentor = wrap(async (req, res) => {
  const { studioId } = req.body, p = periode(req.body)
  if (!p) return gagal(res, 422, 'bulan & tahun wajib')
  if (!(await izin(req, res, studioId))) return
  let k = await prisma.ffKategori.findFirst({ where: { studioId, ...p, nama: 'Mentor' }, include: { item: { select: { nama: true } } } })
  if (!k) k = { ...(await prisma.ffKategori.create({ data: { studioId, ...p, nama: 'Mentor', urutan: await prisma.ffKategori.count({ where: { studioId, ...p } }) } })), item: [] }
  const ada = new Set(k.item.map(i => i.nama))
  const baru = (await posMentor(studioId)).filter(x => !ada.has(x.nama))
  if (baru.length) await prisma.ffItem.createMany({ data: baru.map((x, i) => ({ kategoriId: k.id, studioId, ...p, ...x, urutan: k.item.length + i })) })
  return res.status(201).json({ success: true, message: baru.length ? `Pos gaji mentor ditambahkan (${baru.length})` : 'Pos gaji mentor sudah ada' })
})
// PUT /api/ff/kategori/:id { nama }
export const ubahKategori = wrap(async (req, res) => {
  const k = await ambilKategori(req, res, req.params.id); if (!k) return
  const nama = teks(req.body.nama, 80); if (!nama) return gagal(res, 422, 'Nama kategori wajib diisi')
  await prisma.ffKategori.update({ where: { id: k.id }, data: { nama } })
  return res.json({ success: true })
})
// DELETE /api/ff/kategori/:id
export const hapusKategori = wrap(async (req, res) => {
  const k = await ambilKategori(req, res, req.params.id); if (!k) return
  await prisma.ffKategori.delete({ where: { id: k.id } })
  return res.json({ success: true })
})
// POST /api/ff/kategori/:id/geser { arah: -1 | 1 }
export const geserKategori = wrap(async (req, res) => {
  const k = await ambilKategori(req, res, req.params.id); if (!k) return
  const semua = await prisma.ffKategori.findMany({ where: { studioId: k.studioId, bulan: k.bulan, tahun: k.tahun }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] })
  await tukar(semua, k.id, Number(req.body.arah), (id, urutan) => prisma.ffKategori.update({ where: { id }, data: { urutan } }))
  return res.json({ success: true })
})
async function tukar(daftar, id, arah, simpan) {
  const x = daftar.findIndex(d => d.id === id), y = x + (arah < 0 ? -1 : 1)
  if (x < 0 || y < 0 || y >= daftar.length) return
  ;[daftar[x], daftar[y]] = [daftar[y], daftar[x]]
  await prisma.$transaction(daftar.map((d, i) => simpan(d.id, i)))
}

// POST /api/ff/item { kategoriId, nama?, userId? }
export const tambahItem = wrap(async (req, res) => {
  const k = await ambilKategori(req, res, String(req.body.kategoriId ?? '')); if (!k) return
  const urutan = await prisma.ffItem.count({ where: { kategoriId: k.id } })
  const userId = req.body.userId && (await prisma.ffItem.findFirst({ where: { kategoriId: k.id, userId: req.body.userId } })) ? req.body.userId : null
  const i = await prisma.ffItem.create({ data: { kategoriId: k.id, studioId: k.studioId, bulan: k.bulan, tahun: k.tahun, userId, nama: teks(req.body.nama, 80) || 'Pos baru', urutan } })
  return res.status(201).json({ success: true, data: { id: i.id } })
})
// PUT /api/ff/item/:id { nama?, rupiah?, lunas? }
export const ubahItem = wrap(async (req, res) => {
  const i = await ambilItem(req, res, req.params.id); if (!i) return
  const data = {}
  if (req.body.nama !== undefined) { const n = teks(req.body.nama, 80); if (!n) return gagal(res, 422, 'Nama pos wajib diisi'); data.nama = n }
  if (req.body.rupiah !== undefined) { const n = Number(req.body.rupiah); if (!Number.isFinite(n) || n < 0 || n > 1e12) return gagal(res, 422, 'Nominal harus angka 0 ke atas'); data.rupiah = Math.round(n) }
  if (req.body.lunas !== undefined) data.lunas = !!req.body.lunas
  await prisma.ffItem.update({ where: { id: i.id }, data })
  return res.json({ success: true })
})
// DELETE /api/ff/item/:id
export const hapusItem = wrap(async (req, res) => {
  const i = await ambilItem(req, res, req.params.id); if (!i) return
  await prisma.ffItem.delete({ where: { id: i.id } })
  return res.json({ success: true })
})
// POST /api/ff/item/:id/geser { arah } — di dalam kelompoknya (kategori + orang yang sama)
export const geserItem = wrap(async (req, res) => {
  const i = await ambilItem(req, res, req.params.id); if (!i) return
  const semua = await prisma.ffItem.findMany({ where: { kategoriId: i.kategoriId, userId: i.userId }, orderBy: [{ urutan: 'asc' }, { createdAt: 'asc' }] })
  await tukar(semua, i.id, Number(req.body.arah), (id, urutan) => prisma.ffItem.update({ where: { id }, data: { urutan } }))
  return res.json({ success: true })
})
