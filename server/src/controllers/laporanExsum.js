// EXECUTIVE SUMMARY BULANAN (Karsa Circle, tahap 7, 26 Nov 2026): data untuk PDF ringkasan circle yang dikirim tiap awal bulan.
// Semua angka DITURUNKAN dari data yang sudah ada (aturan "tidak menebak"):
//   pemasukan = order (OrderProduksi) tanggal masuk bulan itu · pengeluaran & kas akhir = buku besar web unit (hitung) ·
//   anggota = peran aktif di studio · Dana Tengah = centang setoran + saldo & pemakaian yang dicatat.
// Studio yang dibuka = wilayah keuangan peran (utils/lingkup.js); studio kolaborasi tidak ikut (STUDIO_DIHITUNG).
import prisma from '../prisma.js'
import { lingkupKeuangan } from '../utils/lingkup.js'
import { STUDIO_DIHITUNG } from '../utils/kolaborasi.js'
import { ORDER_KLIEN } from '../utils/produksi.js'
import { kotorUsd } from '../utils/uang.js'
import { hitung } from './circleBuku.js'
import { DANA_TENGAH_PER_BULAN } from '../config/ecosystem.js'

const gagal = (res, kode, pesan) => res.status(kode).json({ success: false, message: pesan })
const bulanSah = (b) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(b ?? ''))
const wibAwal = (s) => new Date(s + 'T00:00:00+07:00')
const geser = (bulan, n) => { const [t, b] = bulan.split('-').map(Number); const x = t * 12 + (b - 1) + n; return `${Math.floor(x / 12)}-${String((x % 12) + 1).padStart(2, '0')}` }
const rentang = (bulan) => ({ gte: wibAwal(`${bulan}-01`), lt: wibAwal(`${geser(bulan, 1)}-01`) })
const r2 = (n) => Math.round(n * 100) / 100
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const PERAN_TOKOH = ['KEPALA_CIRCLE', 'KOORDINATOR', 'PENDAMPING']

async function pemasukan(studioIds, bulan) {
  const o = await prisma.orderProduksi.findMany({ where: { ...ORDER_KLIEN, studioId: { in: studioIds }, status: { not: 'BATAL' }, tanggalMasuk: rentang(bulan) }, select: { studioId: true, nilaiKotor: true, mataUang: true, kurs: true } })
  const per = new Map()
  for (const x of o) { const e = per.get(x.studioId) ?? { rp: 0, usd: 0, order: 0 }; e.rp += x.nilaiKotor ?? 0; e.usd += kotorUsd(x); e.order += 1; per.set(x.studioId, e) }
  return per
}

// GET /api/reports/executive-summary?bulan=YYYY-MM
export const getExecutiveSummary = async (req, res) => {
  try {
    const { bulan } = req.query
    if (!bulanSah(bulan)) return gagal(res, 422, 'bulan harus YYYY-MM')
    const lingkup = await lingkupKeuangan(req.userRoles)
    const studios = await prisma.studio.findMany({
      where: { ...STUDIO_DIHITUNG, ...(lingkup.semua ? {} : { id: { in: [...lingkup.studioIds] } }) },
      select: { id: true, nama: true, circleId: true, circle: { select: { nama: true } } }, orderBy: { nama: 'asc' },
    })
    if (!studios.length) return gagal(res, 403, 'Tidak ada studio dalam wewenangmu')
    const ids = studios.map(s => s.id)
    const bulanLalu = geser(bulan, -1)
    const enam = Array.from({ length: 6 }, (_, i) => geser(bulan, i - 5))
    const [ini, lalu, tren, peran, setor, saldo, pakai] = await Promise.all([
      pemasukan(ids, bulan), pemasukan(ids, bulanLalu),
      Promise.all(enam.map(async b => { const m = await pemasukan(ids, b); let rp = 0, usd = 0; for (const v of m.values()) { rp += v.rp; usd += v.usd } return { bulan: b, label: NAMA_BULAN[Number(b.slice(5)) - 1].slice(0, 3), rp: Math.round(rp), usd: r2(usd) } })),
      prisma.userRole.findMany({ where: { OR: [{ studioId: { in: ids } }, { circleId: { in: [...new Set(studios.map(s => s.circleId).filter(Boolean))] }, roleType: 'KEPALA_CIRCLE' }], roleType: { not: 'DIGNITY' }, user: { statusAktif: true } }, select: { roleType: true, studioId: true, user: { select: { id: true, nama: true, posisi: true } } } }),
      prisma.danaTengahSetor.findMany({ where: { bulan, studioId: { in: ids } }, select: { studioId: true } }),
      prisma.danaTengahSaldo.findFirst({ where: { tanggal: { lt: new Date(`${geser(bulan, 1)}-01T00:00:00Z`) } }, orderBy: [{ tanggal: 'desc' }, { createdAt: 'desc' }] }),
      prisma.danaTengahPakai.findMany({ where: { tanggal: { gte: new Date(`${bulan}-01T00:00:00Z`), lt: new Date(`${geser(bulan, 1)}-01T00:00:00Z`) } }, orderBy: { tanggal: 'asc' } }),
    ])
    const sudahSetor = new Set(setor.map(s => s.studioId))
    const baris = []
    for (const s of studios) {
      const h = await hitung(s.id, bulan)
      const a = ini.get(s.id) ?? { rp: 0, usd: 0, order: 0 }, b = lalu.get(s.id) ?? { rp: 0, usd: 0, order: 0 }
      const anggota = new Set(peran.filter(p => p.studioId === s.id).map(p => p.user.id))
      const koor = peran.filter(p => p.studioId === s.id && p.roleType === 'KOORDINATOR').map(p => p.user.nama)
      const keluarAda = h.baris.some(x => x.arus === 'EXPENSE')
      baris.push({
        studioId: s.id, nama: s.nama.trim(), koordinator: koor, anggota: anggota.size,
        pemasukanRp: Math.round(a.rp), pemasukanUsd: r2(a.usd), order: a.order,
        pemasukanLaluRp: Math.round(b.rp), perubahanPersen: b.rp > 0 ? Math.round(((a.rp - b.rp) / b.rp) * 1000) / 10 : null,
        pengeluaranRp: keluarAda ? Math.round(h.keluar) : null, labaRp: keluarAda ? Math.round(a.rp - h.keluar) : null,
        kasAkhirRp: h.kasAkhir != null ? Math.round(h.kasAkhir) : null, arusKasDiisi: keluarAda || h.kasAwal != null,
        danaTengah: sudahSetor.has(s.id), statusBuku: h.ditutup ? 'DITUTUP' : 'BERJALAN',
      })
    }
    const jml = (k) => baris.reduce((t, x) => t + (x[k] ?? 0), 0)
    const tokoh = new Map()
    for (const p of peran.filter(p => PERAN_TOKOH.includes(p.roleType))) {
      const e = tokoh.get(p.user.id) ?? { nama: p.user.nama, posisi: p.user.posisi, peran: new Set(), studio: new Set() }
      e.peran.add(p.roleType); if (p.studioId) e.studio.add(studios.find(s => s.id === p.studioId)?.nama.trim()); tokoh.set(p.user.id, e)
    }
    return res.json({ success: true, data: {
      bulan, labelBulan: `${NAMA_BULAN[Number(bulan.slice(5)) - 1]} ${bulan.slice(0, 4)}`, labelBulanLalu: NAMA_BULAN[Number(bulanLalu.slice(5)) - 1],
      circle: [...new Set(studios.map(s => s.circle?.nama).filter(Boolean))].join(', ') || null,
      studio: baris,
      total: { pemasukanRp: jml('pemasukanRp'), pemasukanUsd: r2(jml('pemasukanUsd')), pemasukanLaluRp: jml('pemasukanLaluRp'), order: jml('order'), anggota: new Set(peran.filter(p => p.studioId).map(p => p.user.id)).size,
        pengeluaranRp: jml('pengeluaranRp'), kasAkhirRp: jml('kasAkhirRp'), studioBelumArusKas: baris.filter(x => !x.arusKasDiisi).map(x => x.nama) },
      tren,
      danaTengah: { nominal: DANA_TENGAH_PER_BULAN, sudah: baris.filter(x => x.danaTengah).length, studio: baris.length,
        saldo: saldo ? { tanggal: saldo.tanggal.toISOString().slice(0, 10), jumlah: saldo.jumlah } : null,
        pakai: pakai.map(p => ({ tanggal: p.tanggal.toISOString().slice(0, 10), keperluan: p.keperluan, jumlah: p.jumlah, oleh: p.olehNama })) },
      tokohBawaan: [...tokoh.values()].map(t => ({ nama: t.nama, peran: t.peran.has('KEPALA_CIRCLE') ? 'Kepala Circle' : t.peran.has('KOORDINATOR') ? 'Koordinator' : 'Pendamping', studio: [...t.studio].filter(Boolean).join(', ') }))
        .sort((a, b) => ['Kepala Circle', 'Koordinator', 'Pendamping'].indexOf(a.peran) - ['Kepala Circle', 'Koordinator', 'Pendamping'].indexOf(b.peran)),
    } })
  } catch {
    return gagal(res, 500, 'Gagal menyiapkan Executive Summary')
  }
}
