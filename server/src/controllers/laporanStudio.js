// WEEKLY & MONTHLY REPORT per studio (Karsa, 27 Nov 2026, desain yang disetujui pemilik): terbentuk otomatis dari Daily Sheet
// (order, inbox, freelance) — tidak perlu diketik ulang. Baca saja. Pengelola unit (kelolaStudio).
import prisma from '../prisma.js'
import { kelolaStudio } from '../utils/roles.js'
import { ORDER_KLIEN } from '../utils/produksi.js'
import { KURS_BAWAAN } from '../utils/uang.js'
import { getCpmMapForStudiosBulan } from '../utils/cpm.js'
import { uangMasukUsd, nilaiUsd, indeksMinggu, progresOrder, rentangBulanWib, r2 } from '../utils/dailySheet.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const wrap = (fn) => async (req, res) => { try { await fn(req, res) } catch { gagal(res, 500, 'Terjadi kesalahan, coba lagi') } }
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const AKUN_OTOMATIS = 'Order Internal'
const geser = (bulan, tahun, n) => { const t = tahun * 12 + (bulan - 1) + n; return { bulan: (t % 12) + 1, tahun: Math.floor(t / 12) } }

async function siapkan(req, res) {
  const { studioId } = req.query, bulan = Number(req.query.bulan), tahun = Number(req.query.tahun)
  if (!(bulan >= 1 && bulan <= 12 && tahun >= 2024 && tahun <= 2100)) { gagal(res, 422, 'bulan & tahun wajib'); return null }
  if (!studioId || !(await kelolaStudio(req.userRoles ?? [], studioId))) { gagal(res, 403, 'Laporan studio hanya untuk pengelola unit ini'); return null }
  const [studio, akun, lap] = await Promise.all([
    prisma.studio.findUnique({ where: { id: studioId }, select: { nama: true } }),
    prisma.akunProduksi.findMany({ where: { studioId, namaAkun: { not: AKUN_OTOMATIS } }, select: { id: true, namaAkun: true, platform: true, feePersen: true }, orderBy: { namaAkun: 'asc' } }),
    prisma.weeklyReport.findFirst({ where: { studioId }, orderBy: { periodeAwal: 'desc' }, select: { kurs: true } }),
  ])
  return { studioId, bulan, tahun, studio: studio?.nama ?? null, akun, kurs: lap?.kurs > 0 ? lap.kurs : KURS_BAWAAN }
}
const pilihOrder = { id: true, akunId: true, tanggalMasuk: true, tanggalSelesai: true, tanggalLunas: true, createdAt: true, nilaiKotor: true, nilaiUsd: true, kurs: true, statusBayar: true, partialUsd: true, tipUsd: true, status: true, progresSheet: true }
async function omsetBulanan(studioId, bulan, tahun, kurs, n = 4) {
  const hasil = []
  for (let i = n - 1; i >= 0; i--) {
    const p = geser(bulan, tahun, -i)
    const o = await prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId, status: { not: 'BATAL' }, tanggalMasuk: rentangBulanWib(p.bulan, p.tahun) }, select: pilihOrder })
    hasil.push({ label: `${BULAN[p.bulan - 1]}`, ...p, usd: r2(o.reduce((s, x) => s + uangMasukUsd(x, kurs), 0)) })
  }
  return hasil
}

// GET /api/laporan-studio/mingguan?studioId&bulan&tahun&minggu=1..4
export const mingguan = wrap(async (req, res) => {
  const c = await siapkan(req, res); if (!c) return
  const minggu = Math.min(4, Math.max(1, Number(req.query.minggu) || 1)) - 1
  const rentang = rentangBulanWib(c.bulan, c.tahun), tujuhHari = new Date(Date.now() - 7 * 86400000)
  const [bulanIni, terbuka, inbox, admin, perform, tren] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId: c.studioId, status: { not: 'BATAL' }, tanggalMasuk: rentang }, select: pilihOrder }),
    prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId: c.studioId, status: { notIn: ['BATAL', 'SELESAI'] }, tanggalMasuk: { lt: rentang.gte } }, select: pilihOrder }),
    prisma.inboxSheet.findMany({ where: { studioId: c.studioId, createdAt: { gte: tujuhHari } }, select: { akunId: true } }),
    prisma.produksiAdminMarket.findMany({ where: { studioId: c.studioId }, select: { userId: true, akunIds: true, user: { select: { nama: true } } } }),
    prisma.performaOrang.findMany({ where: { studioId: c.studioId, bulan: c.bulan, tahun: c.tahun, jenis: 'ADMIN' }, select: { userId: true, akunId: true } }),
    omsetBulanan(c.studioId, c.bulan, c.tahun, c.kurs),
  ])
  const semua = [...bulanIni, ...terbuka]
  const perAkun = c.akun.map(a => {
    const o = semua.filter(x => x.akunId === a.id), ob = bulanIni.filter(x => x.akunId === a.id)
    const w = [0, 0, 0, 0]; for (const x of ob) w[indeksMinggu(x.tanggalMasuk)] += uangMasukUsd(x, c.kurs)
    const hitung = (p) => o.filter(x => progresOrder(x) === p).length
    const aktif = o.filter(x => progresOrder(x) !== 'DONE')
    return {
      akunId: a.id, nama: a.namaAkun, platform: a.platform, minggu: w.map(r2), bulanUsd: r2(w.reduce((s, x) => s + x, 0)),
      wip: hitung('WIP'), revisi: hitung('REVISI'), waitlist: hitung('WAITLIST'),
      doneMinggu: ob.filter(x => progresOrder(x) === 'DONE' && indeksMinggu(x.tanggalMasuk) === minggu).length, doneBulan: ob.filter(x => progresOrder(x) === 'DONE').length,
      antreUsd: r2(aktif.reduce((s, x) => s + nilaiUsd(x, c.kurs), 0)),
      // aktivitas 7 hari terakhir
      chatBaru: inbox.filter(x => x.akunId === a.id).length,
      orderBaru: o.filter(x => x.createdAt >= tujuhHari).length,
      bayarBaru: o.filter(x => x.tanggalLunas && x.tanggalLunas >= tujuhHari).length,
      selesai7: o.filter(x => x.tanggalSelesai && x.tanggalSelesai >= tujuhHari).length,
      selesai7Usd: r2(o.filter(x => x.tanggalSelesai && x.tanggalSelesai >= tujuhHari).reduce((s, x) => s + nilaiUsd(x, c.kurs), 0)),
    }
  })
  // Admin PIC: dari Performa (akun yang dipegang bulan ini) atau Admin Market unit
  const pic = new Map()
  for (const a of admin) pic.set(a.userId, { userId: a.userId, nama: a.user.nama, akunIds: a.akunIds })
  for (const p of perform) { const ada = pic.get(p.userId); if (p.akunId) { if (ada) ada.akunIds = [...new Set([p.akunId, ...ada.akunIds])]; else pic.set(p.userId, { userId: p.userId, nama: null, akunIds: [p.akunId] }) } }
  const tanpaNama = [...pic.values()].filter(x => !x.nama).map(x => x.userId)
  if (tanpaNama.length) for (const u of await prisma.user.findMany({ where: { id: { in: tanpaNama } }, select: { id: true, nama: true } })) pic.get(u.id).nama = u.nama
  const totalBulan = perAkun.reduce((s, a) => s + a.bulanUsd, 0)
  return res.json({ success: true, data: {
    studio: c.studio, bulan: c.bulan, tahun: c.tahun, minggu: minggu + 1, kurs: c.kurs, akun: perAkun, tren,
    admin: [...pic.values()].map(x => {
      const ak = perAkun.filter(a => x.akunIds.includes(a.akunId))
      const usd = r2(ak.reduce((s, a) => s + a.bulanUsd, 0))
      const jml = (k) => ak.reduce((s, a) => s + a[k], 0)
      return { userId: x.userId, nama: x.nama, akun: ak.map(a => ({ nama: a.nama, usd: a.bulanUsd })), usd, persen: totalBulan ? Math.round((usd / totalBulan) * 100) : 0,
        wip: jml('wip'), revisi: jml('revisi'), done: jml('doneBulan'), antreUsd: r2(jml('antreUsd')), chatBaru: jml('chatBaru'), orderBaru: jml('orderBaru'), bayarBaru: jml('bayarBaru'), selesai7: jml('selesai7'), selesai7Usd: r2(jml('selesai7Usd')) }
    }).sort((a, b) => b.usd - a.usd),
  } })
})

// GET /api/laporan-studio/bulanan?studioId&bulan&tahun
export const bulanan = wrap(async (req, res) => {
  const c = await siapkan(req, res); if (!c) return
  const rentang = rentangBulanWib(c.bulan, c.tahun)
  const [orders, tren, cpmMap] = await Promise.all([
    prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId: c.studioId, status: { not: 'BATAL' }, tanggalMasuk: rentang }, select: { ...pilihOrder, assignments: { where: { userId: null, berhentiPada: null }, select: { feeTalent: true, statusBayar: true, talentEksternal: { select: { studioId: true } } } } } }),
    omsetBulanan(c.studioId, c.bulan, c.tahun, c.kurs),
    getCpmMapForStudiosBulan([c.studioId], c.bulan, c.tahun),
  ])
  const total = r2(orders.reduce((s, x) => s + uangMasukUsd(x, c.kurs), 0))
  const lalu = tren.length > 1 ? tren[tren.length - 2].usd : 0
  const cpm = cpmMap[c.studioId]?.totalCpm ?? 0
  const akun = c.akun.map(a => {
    const o = orders.filter(x => x.akunId === a.id), w = [0, 0, 0, 0]
    for (const x of o) w[indeksMinggu(x.tanggalMasuk)] += uangMasukUsd(x, c.kurs)
    const usd = r2(w.reduce((s, x) => s + x, 0)), fee = a.feePersen ?? 0
    return { akunId: a.id, nama: a.namaAkun, platform: a.platform, usd, persen: total ? Math.round((usd / total) * 100) : 0, minggu: w.map(r2), feePersen: Math.round(fee * 1000) / 10, bersihRp: Math.round(usd * (1 - fee) * c.kurs) }
  })
  const fl = orders.flatMap(o => o.assignments.map(a => ({ ...a, nilaiRp: nilaiUsd(o, c.kurs) * c.kurs, akunId: o.akunId })))
  const fee = (arr) => Math.round(arr.reduce((s, a) => s + (a.feeTalent ?? 0), 0))
  const lunas = fl.filter(a => a.statusBayar === 'LUNAS')
  const dalam = fl.filter(a => a.talentEksternal?.studioId === c.studioId)
  return res.json({ success: true, data: {
    studio: c.studio, bulan: c.bulan, tahun: c.tahun, kurs: c.kurs,
    totalUsd: total, totalRp: Math.round(total * c.kurs), perubahanPct: lalu > 0 ? Math.round(((total - lalu) / lalu) * 100) : null,
    cpm: Math.round(cpm), cpmSumber: cpmMap[c.studioId]?.sumber ?? 'otomatis', surplusRp: Math.round(total * c.kurs - cpm), cpmTertutupPct: cpm > 0 ? Math.round(((total * c.kurs) / cpm) * 100) : null,
    tren, akun,
    lempar: { jumlah: fl.length, akun: new Set(fl.map(a => a.akunId)).size, totalRp: fee(fl), lunasRp: fee(lunas), lunasJumlah: lunas.length, belumRp: fee(fl) - fee(lunas), belumJumlah: fl.length - lunas.length,
      dalam: dalam.length, luar: fl.length - dalam.length, lewat30: fl.filter(a => (a.feeTalent ?? 0) > a.nilaiRp * 0.3).length },
  } })
})
